const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("deez", {
  getConfig:()=>ipcRenderer.invoke("config:get"), startAuth:id=>ipcRenderer.invoke("auth:start",id), logout:()=>ipcRenderer.invoke("auth:logout"),
  getPlayer:()=>ipcRenderer.invoke("player:get"), getDevices:()=>ipcRenderer.invoke("player:devices"), transfer:(id,play=true)=>ipcRenderer.invoke("player:transfer",id,play),
  play:()=>ipcRenderer.invoke("player:play"), pause:()=>ipcRenderer.invoke("player:pause"), next:()=>ipcRenderer.invoke("player:next"), previous:()=>ipcRenderer.invoke("player:previous"),
  seek:ms=>ipcRenderer.invoke("player:seek",ms), volume:v=>ipcRenderer.invoke("player:volume",v), shuffle:on=>ipcRenderer.invoke("player:shuffle",on), repeat:mode=>ipcRenderer.invoke("player:repeat",mode),
  isSaved:id=>ipcRenderer.invoke("library:contains",id), setSaved:(id,saved)=>ipcRenderer.invoke("library:set",id,saved), getRateLimit:()=>ipcRenderer.invoke("rate-limit:get"),
  minimize:()=>ipcRenderer.invoke("window:minimize"), close:()=>ipcRenderer.invoke("window:close"), pin:v=>ipcRenderer.invoke("window:pin",v), mini:v=>ipcRenderer.invoke("window:mini",v),
  getStartup:()=>ipcRenderer.invoke("startup:get"), setStartup:v=>ipcRenderer.invoke("startup:set",v), openLogs:()=>ipcRenderer.invoke("logs:open"), clearLogs:()=>ipcRenderer.invoke("logs:clear"),
  getSettings:()=>ipcRenderer.invoke("settings:get"), setSettings:s=>ipcRenderer.invoke("settings:set",s),
  onAuthComplete:cb=>ipcRenderer.on("auth:complete",cb), onAuthError:cb=>ipcRenderer.on("auth:error",(_e,msg)=>cb(msg))
});