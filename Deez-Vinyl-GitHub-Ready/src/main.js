const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

const REDIRECT_URI = "http://127.0.0.1:43821/callback";
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-library-read",
  "user-library-modify"
].join(" ");

let win;
let authServer;
const configPath = () => path.join(app.getPath("userData"), "config.json");
const logPath = () => path.join(app.getPath("userData"), "deez-vinyl.log");

function writeLog(level, message, details = "") {
  try { fs.appendFileSync(logPath(), `[${new Date().toISOString()}] ${level}: ${message}${details ? " | "+details : ""}\n`, "utf8"); } catch {}
}
function readConfig(){ try{return JSON.parse(fs.readFileSync(configPath(),"utf8"));}catch{return {};}}
function writeConfig(cfg){fs.mkdirSync(path.dirname(configPath()),{recursive:true});fs.writeFileSync(configPath(),JSON.stringify(cfg,null,2));}
function encrypt(value){if(!value)return null;return safeStorage.isEncryptionAvailable()?{encrypted:true,value:safeStorage.encryptString(value).toString("base64")}:{encrypted:false,value};}
function decrypt(blob){if(!blob)return null;try{return blob.encrypted?safeStorage.decryptString(Buffer.from(blob.value,"base64")):blob.value;}catch{return null;}}
function b64url(buf){return buf.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function createVerifier(){return b64url(crypto.randomBytes(64));}
function createChallenge(v){return b64url(crypto.createHash("sha256").update(v).digest());}

async function tokenRequest(params){
  const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(params)});
  const data=await res.json(); if(!res.ok)throw new Error(data.error_description||data.error||"Spotify token error"); return data;
}
async function getAccessToken(force=false){
  const cfg=readConfig(); const access=decrypt(cfg.accessToken);
  if(!force&&access&&cfg.expiresAt&&Date.now()<cfg.expiresAt-60000)return access;
  const refresh=decrypt(cfg.refreshToken); if(!refresh||!cfg.clientId)return null;
  const t=await tokenRequest({grant_type:"refresh_token",refresh_token:refresh,client_id:cfg.clientId});
  cfg.accessToken=encrypt(t.access_token); if(t.refresh_token)cfg.refreshToken=encrypt(t.refresh_token); cfg.expiresAt=Date.now()+t.expires_in*1000; writeConfig(cfg); return t.access_token;
}
function getCooldownUntil(){return Number(readConfig().rateLimitUntil||0);}
function setCooldown(seconds){const cfg=readConfig();cfg.rateLimitUntil=Date.now()+Math.max(1,Number(seconds||1))*1000;writeConfig(cfg);return cfg.rateLimitUntil;}
function clearExpiredCooldown(){const cfg=readConfig();if(cfg.rateLimitUntil&&Date.now()>=cfg.rateLimitUntil){delete cfg.rateLimitUntil;writeConfig(cfg);}}
async function spotifyRequest(endpoint,options={},retry401=true){
  clearExpiredCooldown(); const until=getCooldownUntil(); if(Date.now()<until)throw new Error(`RATE_LIMIT:${Math.ceil((until-Date.now())/1000)}`);
  const token=await getAccessToken(); if(!token)throw new Error("NOT_AUTHENTICATED");
  writeLog("INFO",`${options.method||"GET"} ${endpoint}`);
  const res=await fetch(`https://api.spotify.com/v1${endpoint}`,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(options.headers||{})}});
  if(res.status===204)return null;
  if(res.status===429){const sec=Math.max(1,Number(res.headers.get("retry-after")||60));setCooldown(sec);writeLog("WARN","Spotify rate limit",`retry-after=${sec}`);throw new Error(`RATE_LIMIT:${sec}`);}
  if(res.status===401&&retry401){await getAccessToken(true);return spotifyRequest(endpoint,options,false);}
  if(!res.ok){let msg=`Spotify error ${res.status}`;try{const d=await res.json();msg=d.error?.message||msg;}catch{}writeLog("ERROR",`Spotify request failed ${res.status}`,msg);throw new Error(msg);}
  return res.json();
}
function createWindow(){
  const cfg=readConfig();
  win=new BrowserWindow({width:cfg.mini?360:430,height:cfg.mini?470:690,minWidth:330,minHeight:430,frame:false,transparent:true,resizable:true,alwaysOnTop:!!cfg.pinned,backgroundColor:"#00000000",webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}});
  win.loadFile(path.join(__dirname,"index.html"));
}

ipcMain.handle("config:get",()=>{const c=readConfig();return{clientId:c.clientId||"",authenticated:!!decrypt(c.refreshToken),redirectUri:REDIRECT_URI};});
ipcMain.handle("auth:start",async(_e,clientId)=>{
  clientId=String(clientId||"").trim();if(!clientId)throw new Error("חסר Client ID");
  const verifier=createVerifier(),state=b64url(crypto.randomBytes(20)),cfg=readConfig();Object.assign(cfg,{clientId,pkceVerifier:encrypt(verifier),oauthState:state});writeConfig(cfg);
  if(authServer)authServer.close();
  authServer=http.createServer(async(req,res)=>{try{const url=new URL(req.url,REDIRECT_URI);if(url.pathname!=="/callback")return;const code=url.searchParams.get("code"),returned=url.searchParams.get("state"),error=url.searchParams.get("error"),current=readConfig();if(error)throw new Error(error);if(!code||returned!==current.oauthState)throw new Error("OAuth state mismatch");const t=await tokenRequest({grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,client_id:current.clientId,code_verifier:decrypt(current.pkceVerifier)});current.accessToken=encrypt(t.access_token);current.refreshToken=encrypt(t.refresh_token);current.expiresAt=Date.now()+t.expires_in*1000;delete current.pkceVerifier;delete current.oauthState;writeConfig(current);res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end("<h2 style='font-family:sans-serif'>Deez Vinyl connected. You can close this tab.</h2>");win?.webContents.send("auth:complete");}catch(err){res.writeHead(400,{"Content-Type":"text/plain; charset=utf-8"});res.end(err.message);win?.webContents.send("auth:error",err.message);}finally{setTimeout(()=>{authServer?.close();authServer=null;},800);}});
  await new Promise((resolve,reject)=>{authServer.once("error",err=>{authServer=null;reject(new Error(`לא ניתן לפתוח את פורט החיבור 43821: ${err.message}`));});authServer.listen(43821,"127.0.0.1",resolve);});
  const u=new URL("https://accounts.spotify.com/authorize");u.search=new URLSearchParams({client_id:clientId,response_type:"code",redirect_uri:REDIRECT_URI,scope:SCOPES,code_challenge_method:"S256",code_challenge:createChallenge(verifier),state}).toString();await shell.openExternal(u.toString());return true;
});
ipcMain.handle("auth:logout",()=>{const c=readConfig();delete c.accessToken;delete c.refreshToken;delete c.expiresAt;writeConfig(c);return true;});

ipcMain.handle("player:get",()=>spotifyRequest("/me/player"));
ipcMain.handle("player:devices",()=>spotifyRequest("/me/player/devices"));
ipcMain.handle("player:transfer",(_e,id,play=true)=>spotifyRequest("/me/player",{method:"PUT",body:JSON.stringify({device_ids:[id],play:!!play})}));
ipcMain.handle("player:play",()=>spotifyRequest("/me/player/play",{method:"PUT"}));
ipcMain.handle("player:pause",()=>spotifyRequest("/me/player/pause",{method:"PUT"}));
ipcMain.handle("player:next",()=>spotifyRequest("/me/player/next",{method:"POST"}));
ipcMain.handle("player:previous",()=>spotifyRequest("/me/player/previous",{method:"POST"}));
ipcMain.handle("player:seek",(_e,ms)=>spotifyRequest(`/me/player/seek?position_ms=${Math.max(0,Math.round(ms))}`,{method:"PUT"}));
ipcMain.handle("player:volume",(_e,v)=>spotifyRequest(`/me/player/volume?volume_percent=${Math.max(0,Math.min(100,Math.round(v)))}`,{method:"PUT"}));
ipcMain.handle("player:shuffle",(_e,on)=>spotifyRequest(`/me/player/shuffle?state=${!!on}`,{method:"PUT"}));
ipcMain.handle("player:repeat",(_e,mode)=>spotifyRequest(`/me/player/repeat?state=${encodeURIComponent(mode)}`,{method:"PUT"}));
ipcMain.handle("library:contains",async(_e,id)=>{const r=await spotifyRequest(`/me/tracks/contains?ids=${encodeURIComponent(id)}`);return !!r?.[0];});
ipcMain.handle("library:set",(_e,id,saved)=>spotifyRequest(`/me/tracks?ids=${encodeURIComponent(id)}`,{method:saved?"PUT":"DELETE"}));
ipcMain.handle("rate-limit:get",()=>{clearExpiredCooldown();const until=getCooldownUntil();return{until,seconds:Math.max(0,Math.ceil((until-Date.now())/1000))};});

ipcMain.handle("window:minimize",()=>win?.minimize());
ipcMain.handle("window:close",()=>win?.close());
ipcMain.handle("window:pin",(_e,v)=>{win?.setAlwaysOnTop(!!v);const c=readConfig();c.pinned=!!v;writeConfig(c);return !!v;});
ipcMain.handle("window:mini",(_e,v)=>{const c=readConfig();c.mini=!!v;writeConfig(c);win?.setSize(v?360:430,v?470:690,true);return !!v;});
ipcMain.handle("startup:get",()=>app.getLoginItemSettings().openAtLogin);
ipcMain.handle("startup:set",(_e,v)=>{app.setLoginItemSettings({openAtLogin:!!v,path:process.execPath});return app.getLoginItemSettings().openAtLogin;});

ipcMain.handle("logs:open",async()=>{try{if(!fs.existsSync(logPath()))fs.writeFileSync(logPath(),"","utf8");await shell.openPath(logPath());return true;}catch{return false;}});
ipcMain.handle("logs:clear",()=>{try{fs.writeFileSync(logPath(),"","utf8");return true;}catch{return false;}});
ipcMain.handle("settings:get",()=>{const c=readConfig();return{rotationSeconds:Number(c.rotationSeconds||8),compact:!!c.compact,glow:c.glow!==false,cat:c.cat!==false,mini:!!c.mini,pinned:!!c.pinned,startup:app.getLoginItemSettings().openAtLogin};});
ipcMain.handle("settings:set",(_e,s)=>{const c=readConfig();Object.assign(c,{rotationSeconds:Math.max(3,Math.min(20,Number(s.rotationSeconds||8))),compact:!!s.compact,glow:s.glow!==false,cat:s.cat!==false,mini:!!s.mini});writeConfig(c);return true;});

app.whenReady().then(createWindow);
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
