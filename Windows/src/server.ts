import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { createSocket, Socket } from "node:dgram";
import { networkInterfaces } from "node:os";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, realpath } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { NativeInput } from "./native-input";

const PORT=47831,DISCOVERY_PORT=47832,DISCOVERY_QUERY="MRKDISCOVER_V1",MAX_MESSAGE_BYTES=16*1024,MAX_FILE_BYTES=100*1024*1024;
const pairingCode=String(randomInt(100000,1000000));
const sessions=new Map<WebSocket,Buffer>();
const attemptsByIp=new Map<string,{count:number;resetAt:number}>();
const nativeInput=new NativeInput();
const baseDir=path.join(process.env.USERPROFILE??process.cwd(),"Documents");
const receiveDir=path.join(baseDir,"MRK-Received");
const sharedDir=path.join(baseDir,"MRK-Shared");

function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(value));}
function bearer(req:IncomingMessage):string|null{const h=req.headers.authorization??"";return h.startsWith("Bearer ")?h.slice(7):null;}
function authorized(req:IncomingMessage):boolean{const candidate=bearer(req);if(!candidate)return false;for(const token of sessions.values())if(safeEqual(candidate,token.toString("hex")))return true;return false;}
function safeName(input:string):string{const name=path.basename(input).replace(/[<>:"/\\|?*\\x00-\\x1f]/g,"_").trim();if(!name||name==="."||name==="..")throw new Error("Invalid filename");return name.slice(0,180);}
async function handleHttp(req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url??"/","http://localhost");
  if(url.pathname==="/"&&req.method==="GET"){json(res,200,{name:"MRK Connect",version:1,port:PORT});return;}
  if(!authorized(req)){json(res,401,{error:"UNAUTHORIZED"});return;}
  if(url.pathname==="/api/upload"&&req.method==="POST"){
    const declared=Number(req.headers["content-length"]??0);
    if(declared>MAX_FILE_BYTES){json(res,413,{error:"FILE_TOO_LARGE",limit:MAX_FILE_BYTES});return;}
    let name:string;try{name=safeName(url.searchParams.get("name")??"");}catch{json(res,400,{error:"INVALID_FILENAME"});return;}
    await mkdir(receiveDir,{recursive:true});
    const target=path.join(receiveDir,`${Date.now()}-${name}`);
    let received=0;
    const limiter=new Transform({transform(chunk:Buffer,_enc,callback){received+=chunk.length;if(received>MAX_FILE_BYTES){callback(new Error("FILE_TOO_LARGE"));return;}callback(null,chunk);}});
    try{await pipeline(req,limiter,createWriteStream(target,{flags:"wx"}));json(res,201,{ok:true,name:path.basename(target),bytes:received});}
    catch(error){try{const fs=await import("node:fs/promises");await fs.unlink(target);}catch{};json(res,received>MAX_FILE_BYTES?413:400,{error:received>MAX_FILE_BYTES?"FILE_TOO_LARGE":"UPLOAD_FAILED"});}
    return;
  }
  if(url.pathname==="/api/files"&&req.method==="GET"){
    await mkdir(sharedDir,{recursive:true});
    const entries=await readdir(sharedDir,{withFileTypes:true});
    const files=[];
    for(const entry of entries){
      // Never follow symlinks: MRK-Shared must not become a bridge to files elsewhere.
      if(!entry.isFile())continue;
      const full=path.join(sharedDir,entry.name);
      try {
        const info=await stat(full);
        if(!info.isFile())continue;
        files.push({name:entry.name,size:info.size,modified:info.mtime.toISOString()});
      } catch { /* Ignore files removed while listing. */ }
    }
    files.sort((a,b)=>b.modified.localeCompare(a.modified));
    json(res,200,{files:files.slice(0,500)});return;
  }
  if(url.pathname==="/api/download"&&req.method==="GET"){
    let name:string;try{name=safeName(url.searchParams.get("name")??"");}catch{json(res,400,{error:"INVALID_FILENAME"});return;}
    const target=path.resolve(sharedDir,name);
    if(path.dirname(target)!==sharedDir){json(res,400,{error:"INVALID_PATH"});return;}
    try{const resolved=await realpath(target);
      const allowedRoot=await realpath(sharedDir);
      if(path.dirname(resolved)!==allowedRoot){json(res,403,{error:"OUTSIDE_SHARED_FOLDER"});return;}
      const info=await stat(resolved);if(!info.isFile()){json(res,404,{error:"NOT_FOUND"});return;}res.writeHead(200,{"content-type":"application/octet-stream","content-length":info.size,"content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,"cache-control":"no-store"});createReadStream(resolved).pipe(res);}
    catch{json(res,404,{error:"NOT_FOUND"});}return;
  }
  json(res,404,{error:"NOT_FOUND"});
}
const httpServer=createServer((req,res)=>{void handleHttp(req,res).catch(()=>{if(!res.headersSent)json(res,500,{error:"INTERNAL_ERROR"});else res.destroy();});});
httpServer.requestTimeout=120_000;
httpServer.headersTimeout=15_000;
httpServer.keepAliveTimeout=5_000;
const wss=new WebSocketServer({server:httpServer,maxPayload:MAX_MESSAGE_BYTES,perMessageDeflate:false,maxClients:4});
export type HostInfo={port:number;pairingCode:string;addresses:string[];status:"waiting"|"connected";qrDataUrl?:string};
let onStatus:(status:HostInfo["status"])=>void=()=>undefined;
let hostStarted=false;
let discoverySocket:Socket|null=null;
function startDiscovery(){
  if(discoverySocket)return;
  const socket=createSocket("udp4");discoverySocket=socket;
  socket.on("message",(message,remote)=>{
    if(message.toString("utf8").trim()!==DISCOVERY_QUERY)return;
    const response=Buffer.from(JSON.stringify({type:"mrkConnectHost",version:1,port:PORT,addresses:getLocalIPv4Addresses()}));
    socket.send(response,remote.port,remote.address);
  });
  socket.on("error",()=>{socket.close();if(discoverySocket===socket)discoverySocket=null;});
  socket.bind(DISCOVERY_PORT,"0.0.0.0");
}
function getLocalIPv4Addresses():string[]{const result:string[]=[];for(const entries of Object.values(networkInterfaces()))for(const entry of entries??[])if(entry.family==="IPv4"&&!entry.internal&&!entry.address.startsWith("169.254."))result.push(entry.address);return [...new Set(result)];}
function send(ws:WebSocket,value:unknown){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(value));}
function safeEqual(a:string,b:string):boolean{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function allowPair(ip:string):boolean{const now=Date.now(),entry=attemptsByIp.get(ip);if(!entry||now>=entry.resetAt){attemptsByIp.set(ip,{count:1,resetAt:now+60000});return true;}if(entry.count>=5)return false;entry.count++;return true;}
function validInput(m:Record<string,unknown>):boolean{switch(m.type){case"mouseMove":return Number.isInteger(m.x)&&Number.isInteger(m.y)&&Math.abs(m.x as number)<=300&&Math.abs(m.y as number)<=300;case"mouseButton":return["left","right","middle"].includes(String(m.button))&&typeof m.down==="boolean";case"mouseScroll":return Number.isInteger(m.delta)&&Math.abs(m.delta as number)<=1200;case"key":return typeof m.key==="string"&&m.key.length<=12&&typeof m.down==="boolean";case"text":return typeof m.text==="string"&&m.text.length<=4000;default:return false;}}
wss.on("connection",(ws,request)=>{const ip=request.socket.remoteAddress??"unknown";let authenticated=false;ws.on("message",raw=>{let m:Record<string,unknown>;try{m=JSON.parse(raw.toString()) as Record<string,unknown>;}catch{ws.close(1003,"Invalid JSON");return;}if(m.type==="pairRequest"){if(authenticated||sessions.size>=4||!allowPair(ip)){send(ws,{type:"pairResult",accepted:false,reason:sessions.size>=4?"SESSION_LIMIT":"RATE_LIMITED"});ws.close(1008,"Pairing limit");return;}if(typeof m.pairingCode!=="string"||!safeEqual(m.pairingCode,pairingCode)){send(ws,{type:"pairResult",accepted:false});ws.close(1008,"Pairing rejected");return;}const token=randomBytes(32);sessions.set(ws,token);authenticated=true;onStatus("connected");send(ws,{type:"pairResult",accepted:true,sessionToken:token.toString("hex")});return;}const token=sessions.get(ws);if(!token||typeof m.sessionToken!=="string"||!safeEqual(m.sessionToken,token.toString("hex"))){ws.close(1008,"Authentication required");return;}if(m.type==="ping"){send(ws,{type:"pong"});return;}if(!validInput(m)){send(ws,{type:"error",code:"INVALID_INPUT"});return;}if(!nativeInput.send(m as never))send(ws,{type:"error",code:"INPUT_ADAPTER_UNAVAILABLE",message:"Build the Windows native input helper first."});});ws.on("close",()=>{
    sessions.delete(ws);
    // A phone can disappear while a drag or modifier is held. Release transient
    // input state so Windows never gets left with a stuck mouse button/key.
    if(authenticated){
      for(const button of ["left","right","middle"] as const)nativeInput.send({type:"mouseButton",button,down:false});
      for(const key of ["shift","ctrl","alt","meta"])nativeInput.send({type:"key",key,down:false});
    }
    if(sessions.size===0)onStatus("waiting");
  });});
export function startLocalHost(callback:(status:HostInfo["status"])=>void):Promise<HostInfo>{onStatus=callback;nativeInput.start();startDiscovery();return new Promise((resolve,reject)=>{httpServer.once("error",reject);httpServer.listen(PORT,"0.0.0.0",()=>{httpServer.removeListener("error",reject);hostStarted=true;resolve({port:PORT,pairingCode,addresses:getLocalIPv4Addresses(),status:"waiting"});});});}
export function stopLocalHost():Promise<void>{if(!hostStarted){nativeInput.stop();return Promise.resolve();}hostStarted=false;sessions.clear();nativeInput.stop();if(discoverySocket){discoverySocket.close();discoverySocket=null;}for(const client of wss.clients)client.close(1001,"Host shutting down");return new Promise(resolve=>{wss.close(()=>httpServer.close(()=>resolve()));});}
