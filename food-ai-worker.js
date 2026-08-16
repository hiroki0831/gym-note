// Cloudflare Worker: ジムノート v5 AI食事解析
// Secrets / variables:
//   OPENAI_API_KEY  : OpenAI API key (secret)
//   APP_PIN         : personal PIN (secret, 8+ chars recommended)
//   ALLOWED_ORIGIN  : e.g. https://YOURNAME.github.io

const CORS_BASE = {
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-App-Pin",
  "Vary": "Origin"
};
function cors(env, origin){
  const allowed=String(env.ALLOWED_ORIGIN||"").replace(/\/$/,"");
  const o=String(origin||"").replace(/\/$/,"");
  return {...CORS_BASE,"Access-Control-Allow-Origin": allowed && o===allowed ? o : allowed || "null"};
}
function json(body,status,headers){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8",...headers}})}
function outputText(data){
  if(typeof data?.output_text==="string")return data.output_text;
  for(const out of data?.output||[])for(const c of out?.content||[])if(c?.type==="output_text"&&typeof c.text==="string")return c.text;
  return "";
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get("Origin")||"";
    const headers=cors(env,origin);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="POST")return json({error:"POST only"},405,headers);
    const allowed=String(env.ALLOWED_ORIGIN||"").replace(/\/$/,"");
    if(allowed && String(origin).replace(/\/$/,"")!==allowed)return json({error:"Origin not allowed"},403,headers);
    if(!env.OPENAI_API_KEY)return json({error:"OPENAI_API_KEY is not configured"},500,headers);
    if(!env.APP_PIN)return json({error:"APP_PIN is not configured"},500,headers);
    if(request.headers.get("X-App-Pin")!==env.APP_PIN)return json({error:"PINが違います"},401,headers);

    let body;
    try{body=await request.json()}catch{return json({error:"Invalid JSON"},400,headers)}
    const text=String(body?.text||"").trim().slice(0,1000);
    const meal=String(body?.meal||"食事").slice(0,20);
    if(!text)return json({error:"食事内容が空です"},400,headers);

    const schema={
      type:"object",additionalProperties:false,
      properties:{
        title:{type:"string"},
        items:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},amount:{type:"string"},kcal:{type:"number"}},required:["name","amount","kcal"]}},
        total_kcal:{type:"number"},protein_g:{type:"number"},fat_g:{type:"number"},carbs_g:{type:"number"},
        confidence:{type:"string",enum:["high","medium","low"]},note:{type:"string"}
      },
      required:["title","items","total_kcal","protein_g","fat_g","carbs_g","confidence","note"]
    };
    const prompt=`${meal}: ${text}`;
    const api=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"gpt-5.6-luna",
        reasoning:{effort:"low"},
        input:[
          {role:"system",content:"あなたは日本の食事記録用カロリー推定アシスタントです。入力された食品・料理を一般的な1人前として推定し、数量や商品名があれば優先してください。カロリーとPFCは推定値であり、断定しすぎないでください。商品名が特定できても外部検索はせず、知識にない場合は一般的な近似を使いconfidenceを下げてください。"},
          {role:"user",content:prompt}
        ],
        text:{format:{type:"json_schema",name:"food_estimate",strict:true,schema}},
        max_output_tokens:1000
      })
    });
    const data=await api.json();
    if(!api.ok)return json({error:data?.error?.message||"OpenAI API error"},502,headers);
    const txt=outputText(data);
    if(!txt)return json({error:"AI response was empty"},502,headers);
    try{return json(JSON.parse(txt),200,headers)}catch{return json({error:"AI response parse error"},502,headers)}
  }
};
