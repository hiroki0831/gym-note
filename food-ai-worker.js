// Cloudflare Worker: ジムノート v5.8 AI食事・写真栄養解析
const CORS_BASE={"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-App-Pin","Vary":"Origin"};
function cors(env,origin){const allowed=String(env.ALLOWED_ORIGIN||"").replace(/\/$/,""),o=String(origin||"").replace(/\/$/,"");return {...CORS_BASE,"Access-Control-Allow-Origin":allowed&&o===allowed?o:allowed||"null"}}
function json(body,status,headers){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8",...headers}})}
function outputText(data){if(typeof data?.output_text==="string")return data.output_text;for(const out of data?.output||[])for(const c of out?.content||[])if(c?.type==="output_text"&&typeof c.text==="string")return c.text;return ""}
export default{async fetch(request,env){
  const origin=request.headers.get("Origin")||"",headers=cors(env,origin);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return json({error:"POST only"},405,headers);
  const allowed=String(env.ALLOWED_ORIGIN||"").replace(/\/$/,"");
  if(allowed&&String(origin).replace(/\/$/,"")!==allowed)return json({error:"Origin not allowed"},403,headers);
  if(!env.OPENAI_API_KEY)return json({error:"OPENAI_API_KEY is not configured"},500,headers);
  if(!env.APP_PIN)return json({error:"APP_PIN is not configured"},500,headers);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400,headers)}
  const suppliedPin=String(body?.pin||request.headers.get("X-App-Pin")||"");
  if(suppliedPin!==env.APP_PIN)return json({error:"PINが違います"},401,headers);
  const text=String(body?.text||"").trim().slice(0,1000),meal=String(body?.meal||"食事").slice(0,20),image=String(body?.image||"");
  const validImage=/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(image);
  if(!text&&!validImage)return json({error:"食事内容または写真が必要です"},400,headers);
  if(image&&!validImage)return json({error:"対応していない画像形式です"},400,headers);
  const schema={type:"object",additionalProperties:false,properties:{
    title:{type:"string"},
    items:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},amount:{type:"string"},kcal:{type:"number"}},required:["name","amount","kcal"]}},
    total_kcal:{type:"number"},protein_g:{type:"number"},fat_g:{type:"number"},carbs_g:{type:"number"},fiber_g:{type:"number"},salt_g:{type:"number"},calcium_mg:{type:"number"},iron_mg:{type:"number"},potassium_mg:{type:"number"},
    confidence:{type:"string",enum:["high","medium","low"]},note:{type:"string"}
  },required:["title","items","total_kcal","protein_g","fat_g","carbs_g","fiber_g","salt_g","calcium_mg","iron_mg","potassium_mg","confidence","note"]};
  const prompt=`${meal}${text?`: ${text}`:""}。写真がある場合は写っている料理・食品と量を推定してください。栄養はカロリー、PFC、食物繊維、食塩相当量、カルシウム、鉄、カリウムを推定してください。写真だけでは分からない重量や調味料量は断定せずconfidenceを下げてください。`;
  const userContent=[{type:"input_text",text:prompt}];if(validImage)userContent.push({type:"input_image",image_url:image});
  const api=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({
    model:"gpt-5.6-luna",reasoning:{effort:"low"},
    input:[{role:"system",content:"あなたは日本の食事記録用の栄養推定アシスタントです。入力文と食事写真から一般的な1人前として量と栄養を推定します。写真だけでは正確な重量や調味料量は分からないため推定値として扱い、曖昧な場合はconfidenceを下げてください。"},{role:"user",content:userContent}],
    text:{format:{type:"json_schema",name:"food_estimate",strict:true,schema}},max_output_tokens:1200
  })});
  const data=await api.json();if(!api.ok)return json({error:data?.error?.message||"OpenAI API error"},502,headers);
  const txt=outputText(data);if(!txt)return json({error:"AI response was empty"},502,headers);
  try{return json(JSON.parse(txt),200,headers)}catch{return json({error:"AI response parse error"},502,headers)}
}};