import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

type PairResult = { type: "pairResult"; accepted: boolean; sessionToken?: string };
const DEFAULT_PORT = "47831";

export default function HomeScreen() {
  const [address,setAddress]=useState(""); const [port,setPort]=useState(DEFAULT_PORT); const [pin,setPin]=useState("");
  const [status,setStatus]=useState("Not connected"); const [error,setError]=useState(""); const [paired,setPaired]=useState(false);
  const [draft,setDraft]=useState("");
  const [voiceActive,setVoiceActive]=useState(false);
  const [voiceLanguage,setVoiceLanguage]=useState("hi-IN");
  const [voiceStatus,setVoiceStatus]=useState("Ready to listen");
  const [sharedFiles,setSharedFiles]=useState<Array<{name:string;size:number;modified:string}>>([]);
  const [transferStatus,setTransferStatus]=useState("");
  const [transferring,setTransferring]=useState(false);
  const socket=useRef<WebSocket|null>(null); const token=useRef<string|null>(null); const last=useRef({x:0,y:0}); const moved=useRef(false); const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null); const dragging=useRef(false); const lastTap=useRef(0);

  const sendCommand=(command:Record<string,unknown>)=>{
    if(socket.current?.readyState===WebSocket.OPEN && token.current) socket.current.send(JSON.stringify({...command,sessionToken:token.current}));
  };
  const touchpad=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:()=>{
      last.current={x:0,y:0};moved.current=false;dragging.current=false;
      if(holdTimer.current)clearTimeout(holdTimer.current);
      holdTimer.current=setTimeout(()=>{
        dragging.current=true;
        sendCommand({type:"mouseButton",button:"left",down:true});
      },420);
    },
    onPanResponderMove:(_,g)=>{
      const dx=g.dx-last.current.x,dy=g.dy-last.current.y;
      last.current={x:g.dx,y:g.dy};
      if(Math.abs(g.dx)+Math.abs(g.dy)>3){
        moved.current=true;
        if(holdTimer.current){clearTimeout(holdTimer.current);holdTimer.current=null;}
      }
      if(dx!==0||dy!==0)sendCommand({type:"mouseMove",x:Math.round(dx*1.8),y:Math.round(dy*1.8)});
    },
    onPanResponderRelease:()=>{
      if(holdTimer.current){clearTimeout(holdTimer.current);holdTimer.current=null;}
      if(dragging.current){
        sendCommand({type:"mouseButton",button:"left",down:false});
        dragging.current=false;
        return;
      }
      if(!moved.current){
        const now=Date.now();
        sendCommand({type:"mouseButton",button:"left",down:true});
        sendCommand({type:"mouseButton",button:"left",down:false});
        if(now-lastTap.current<320){
          sendCommand({type:"mouseButton",button:"left",down:true});
          sendCommand({type:"mouseButton",button:"left",down:false});
          lastTap.current=0;
        }else lastTap.current=now;
      }
    },
    onPanResponderTerminate:()=>{
      if(holdTimer.current){clearTimeout(holdTimer.current);holdTimer.current=null;}
      if(dragging.current)sendCommand({type:"mouseButton",button:"left",down:false});
      dragging.current=false;
    }
  })).current;

  useSpeechRecognitionEvent("start",()=>{setVoiceActive(true);setVoiceStatus("Listening…");});
  useSpeechRecognitionEvent("end",()=>{setVoiceActive(false);setVoiceStatus("Voice capture stopped. Review the text before sending.");});
  useSpeechRecognitionEvent("result",(event)=>{
    const transcript=event.results?.[0]?.transcript;
    if(transcript)setDraft(current=>event.isFinal?current+" "+transcript:transcript);
  });
  useSpeechRecognitionEvent("error",(event)=>{
    setVoiceActive(false);
    setVoiceStatus(event.error==="not-allowed"?"Microphone/speech permission denied":`Voice error: ${event.error}`);
  });
  useEffect(()=>()=>{socket.current?.close();ExpoSpeechRecognitionModule.abort();},[]);
  const connect=()=>{
    setError("");setPaired(false);token.current=null;socket.current?.close();
    const host=address.trim(),p=port.trim();
    if(!host||!/^\\d{1,5}$/.test(p)||Number(p)<1||Number(p)>65535||!/^\\d{6}$/.test(pin)){setError("PC IP, valid port aur 6-digit PIN enter karein.");return;}
    setStatus("Connecting…");const ws=new WebSocket(`ws://${host}:${p}`);socket.current=ws;
    ws.onopen=()=>{setStatus("Sending pairing request…");ws.send(JSON.stringify({type:"pairRequest",pairingCode:pin}));};
    ws.onmessage=(event)=>{try{const m=JSON.parse(String(event.data)) as PairResult;if(m.type==="pairResult"&&m.accepted&&m.sessionToken){token.current=m.sessionToken;setPaired(true);setStatus("Connected to Windows PC");setError("");}else if(m.type==="pairResult"){setStatus("Pairing rejected");setError("PIN galat ya pairing limit poori. Windows par PIN check karein.");}}catch{setError("PC se invalid response mila.");}};
    ws.onerror=()=>{setStatus("Connection failed");setError("PC IP, port aur same Wi-Fi/hotspot check karein.");};
    ws.onclose=()=>{setPaired(false);token.current=null;setStatus("Disconnected");};
  };
  const disconnect=()=>{socket.current?.close();socket.current=null;token.current=null;setPaired(false);setSharedFiles([]);setStatus("Disconnected");};
  const httpBase=()=>`http://${address.trim()}:${port.trim()}`;
  const authHeaders=()=>({Authorization:`Bearer ${token.current??""}`});
  const refreshSharedFiles=async()=>{
    if(!token.current)return;
    try{
      const response=await fetch(`${httpBase()}/api/files`,{headers:authHeaders()});
      if(!response.ok)throw new Error(response.status===401?"Session expired":"Could not list shared files");
      const data=await response.json() as {files:Array<{name:string;size:number;modified:string}>};
      setSharedFiles(data.files??[]);
      setTransferStatus(data.files?.length?`${data.files.length} shared file(s) available`:"No files in MRK-Shared folder");
    }catch(e){setTransferStatus(e instanceof Error?e.message:"File list failed");}
  };
  const uploadFile=async()=>{
    if(!token.current||transferring)return;
    try{
      const picked=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true,multiple:false});
      if(picked.canceled||!picked.assets?.[0])return;
      const file=picked.assets[0];
      if(file.size!==undefined&&file.size>100*1024*1024){Alert.alert("File too large","Maximum file size is 100 MiB.");return;}
      setTransferring(true);setTransferStatus("Uploading "+file.name+"…");
      const result=await FileSystem.uploadAsync(`${httpBase()}/api/upload?name=${encodeURIComponent(file.name)}`,file.uri,{
        httpMethod:"POST",uploadType:FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers:{...authHeaders(),"Content-Type":"application/octet-stream"}
      });
      if(result.status<200||result.status>=300)throw new Error(`Upload failed (HTTP ${result.status})`);
      setTransferStatus("Uploaded: "+file.name);
    }catch(e){setTransferStatus(e instanceof Error?e.message:"Upload failed");}
    finally{setTransferring(false);}
  };
  const downloadFile=async(name:string)=>{
    if(!token.current||transferring)return;
    try{
      setTransferring(true);setTransferStatus("Downloading "+name+"…");
      const target=(FileSystem.cacheDirectory??FileSystem.documentDirectory??"")+"mrk-"+Date.now()+"-"+name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const result=await FileSystem.downloadAsync(`${httpBase()}/api/download?name=${encodeURIComponent(name)}`,target,{headers:authHeaders()});
      if(result.status<200||result.status>=300)throw new Error(`Download failed (HTTP ${result.status})`);
      setTransferStatus("Downloaded: "+name);
      if(await Sharing.isAvailableAsync())await Sharing.shareAsync(result.uri,{dialogTitle:"Save or share "+name});
      else Alert.alert("Downloaded",`File saved in app cache: ${result.uri}`);
    }catch(e){setTransferStatus(e instanceof Error?e.message:"Download failed");}
    finally{setTransferring(false);}
  };
  const startVoice=async()=>{
    if(!paired){setVoiceStatus("Connect to the PC first");return;}
    try{
      const permission=await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if(!permission.granted){setVoiceStatus("Microphone and speech permission are required");return;}
      setDraft("");
      setVoiceStatus("Starting microphone…");
      ExpoSpeechRecognitionModule.start({lang:voiceLanguage,interimResults:true,continuous:false,addsPunctuation:true,maxAlternatives:1});
    }catch(e){setVoiceStatus(e instanceof Error?e.message:"Could not start voice typing");}
  };
  const stopVoice=()=>ExpoSpeechRecognitionModule.stop();
  const sendText=()=>{if(draft.trim()){sendCommand({type:"text",text:draft.trim()});setDraft("");setVoiceStatus("Reviewed text sent to PC");}};
  const key=(name:string)=>{sendCommand({type:"key",key:name,down:true});sendCommand({type:"key",key:name,down:false});};
  const shortcut=(modifier:string,name:string)=>{sendCommand({type:"key",key:modifier,down:true});sendCommand({type:"key",key:name,down:true});sendCommand({type:"key",key:name,down:false});sendCommand({type:"key",key:modifier,down:false});};

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>MRK</Text></View><View><Text style={styles.title}>MRK Connect</Text><Text style={styles.subtitle}>Android companion for Windows</Text></View><Text style={styles.badge}>V0.1</Text></View>
      <View style={styles.hero}><Text style={styles.eyebrow}>LOCAL NETWORK CONNECTION</Text><Text style={styles.heading}>Your phone. Your PC. Connected.</Text><Text style={styles.description}>Dono devices ko same Wi-Fi ya phone hotspot par rakhein. Internet ki zaroorat nahi.</Text></View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Pair Windows PC</Text><Text style={styles.label}>PC IPv4 address</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder="192.168.43.120" placeholderTextColor="#71857a" autoCapitalize="none" keyboardType="decimal-pad" style={styles.input}/>
        <View style={styles.row}><View style={styles.portBox}><Text style={styles.label}>Port</Text><TextInput value={port} onChangeText={setPort} keyboardType="number-pad" style={styles.input}/></View><View style={styles.pinBox}><Text style={styles.label}>6-digit Windows PIN</Text><TextInput value={pin} onChangeText={v=>setPin(v.replace(/\\D/g,"").slice(0,6))} keyboardType="number-pad" maxLength={6} secureTextEntry style={styles.input}/></View></View>
        <View style={styles.statusRow}><View style={[styles.dot,{backgroundColor:paired?"#65d99a":"#d6a64b"}]}/><Text style={styles.status}>{status}</Text></View>
        {!!error&&<Text style={styles.error}>{error}</Text>}
        <Pressable onPress={paired?disconnect:connect} style={styles.primary}><Text style={styles.primaryText}>{paired?"Disconnect":"Connect & Pair"}</Text></Pressable>
      </View>
      {paired&&<View style={styles.panel}>
        <Text style={styles.sectionTitle}>Wireless Mouse</Text><Text style={styles.hint}>Ungli se pad par move karein. Tap = left click.</Text>
        <View {...touchpad.panHandlers} style={styles.touchpad}><Text style={styles.touchText}>TOUCHPAD</Text><Text style={styles.hint}>Move · Tap click · Double tap double-click · Hold and move to drag</Text></View>
        <View style={styles.row}><Pressable style={styles.action} onPress={()=>{sendCommand({type:"mouseButton",button:"left",down:true});sendCommand({type:"mouseButton",button:"left",down:false});}}><Text style={styles.actionText}>Left Click</Text></Pressable><Pressable style={styles.action} onPress={()=>{sendCommand({type:"mouseButton",button:"right",down:true});sendCommand({type:"mouseButton",button:"right",down:false});}}><Text style={styles.actionText}>Right Click</Text></Pressable></View>
        <View style={styles.row}><Pressable style={styles.action} onPress={()=>sendCommand({type:"mouseScroll",delta:480})}><Text style={styles.actionText}>Scroll Up</Text></Pressable><Pressable style={styles.action} onPress={()=>sendCommand({type:"mouseScroll",delta:-480})}><Text style={styles.actionText}>Scroll Down</Text></Pressable></View>
        <Text style={[styles.sectionTitle,{marginTop:18}]}>Voice Typing</Text>
        <Text style={styles.hint}>Bol kar text banayein. PC par bhejne se pehle text yahin edit aur review kar sakte hain.</Text>
        <View style={styles.row}>
          {["hi-IN","en-IN","ur-PK"].map(lang=><Pressable key={lang} onPress={()=>setVoiceLanguage(lang)} style={[styles.keyButton,voiceLanguage===lang&&{backgroundColor:"#16865b"}]}><Text style={styles.actionText}>{lang}</Text></Pressable>)}
        </View>
        <Pressable onPress={voiceActive?stopVoice:startVoice} style={[styles.primary,voiceActive&&{backgroundColor:"#a34b42"}]}><Text style={styles.primaryText}>{voiceActive?"Stop Listening":"Start Voice Typing"}</Text></Pressable>
        <Text style={styles.transferStatus}>{voiceStatus}</Text>
        <Text style={[styles.sectionTitle,{marginTop:18}]}>Keyboard / Text</Text><TextInput value={draft} onChangeText={setDraft} placeholder="Type text to send to focused PC app" placeholderTextColor="#71857a" style={styles.input} multiline/>
        <Pressable onPress={sendText} style={styles.primary}><Text style={styles.primaryText}>Send Text to PC</Text></Pressable>
        <View style={styles.row}>{["enter","backspace","tab","escape"].map(k=><Pressable key={k} onPress={()=>key(k)} style={styles.keyButton}><Text style={styles.actionText}>{k.toUpperCase()}</Text></Pressable>)}</View>
        <Text style={[styles.label,{marginTop:12}]}>Quick Shortcuts</Text>
        <View style={styles.row}>{[{label:"Copy",key:"c"},{label:"Paste",key:"v"},{label:"Select All",key:"a"},{label:"Undo",key:"z"}].map(item=><Pressable key={item.key} onPress={()=>shortcut("ctrl",item.key)} style={styles.keyButton}><Text style={styles.actionText}>{item.label}</Text></Pressable>)}</View>
        <View style={styles.row}>{[{label:"Alt + Tab",mod:"alt",key:"tab"},{label:"Win + D",mod:"meta",key:"d"}].map(item=><Pressable key={item.label} onPress={()=>shortcut(item.mod,item.key)} style={styles.keyButton}><Text style={styles.actionText}>{item.label}</Text></Pressable>)}</View>
      </View>}
      {paired&&<View style={styles.panel}>
        <Text style={styles.sectionTitle}>Two-way File Transfer</Text>
        <Text style={styles.hint}>Phone se PC: file MRK-Received folder mein jayegi. PC se phone: sirf MRK-Shared folder ki files dikhengi. Limit 100 MiB.</Text>
        <Pressable disabled={transferring} onPress={uploadFile} style={[styles.primary,transferring&&{opacity:0.55}]}><Text style={styles.primaryText}>Choose File & Send to PC</Text></Pressable>
        <Pressable disabled={transferring} onPress={refreshSharedFiles} style={styles.action}><Text style={styles.actionText}>Refresh PC Shared Files</Text></Pressable>
        {!!transferStatus&&<Text style={styles.transferStatus}>{transferStatus}</Text>}
        {sharedFiles.map(file=><View key={file.name} style={styles.fileRow}>
          <View style={{flex:1}}><Text style={styles.fileName}>{file.name}</Text><Text style={styles.hint}>{(file.size/1024/1024).toFixed(2)} MiB · {new Date(file.modified).toLocaleDateString()}</Text></View>
          <Pressable disabled={transferring} onPress={()=>downloadFile(file.name)} style={styles.downloadButton}><Text style={styles.actionText}>Download</Text></Pressable>
        </View>)}
      </View>}
      <View style={styles.features}><Text style={styles.sectionTitle}>More features in development</Text>{["PC audio on phone speaker","Automatic PC discovery and QR pairing"].map(item=><View key={item} style={styles.feature}><Text style={styles.featureMark}>•</Text><Text style={styles.featureText}>{item}</Text></View>)}</View>
      <Text style={styles.footer}>Pair only with a PC you trust. Local network connection.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:"#0b1210"},content:{paddingHorizontal:21,paddingTop:58,paddingBottom:28},
 header:{flexDirection:"row",alignItems:"center",gap:12},logo:{width:45,height:45,borderRadius:13,backgroundColor:"#16865b",alignItems:"center",justifyContent:"center"},logoText:{color:"#fff",fontWeight:"900"},title:{color:"#eef5f1",fontSize:18,fontWeight:"800"},subtitle:{color:"#a9bbb2",fontSize:12,marginTop:3},badge:{marginLeft:"auto",color:"#9ce2bb",fontSize:10,borderWidth:1,borderColor:"#345548",padding:7,borderRadius:12},
 hero:{marginTop:32,marginBottom:19},eyebrow:{color:"#79d6a5",fontSize:10,fontWeight:"800",letterSpacing:2},heading:{color:"#eef5f1",fontSize:30,fontWeight:"900",lineHeight:36,marginTop:10},description:{color:"#a9bbb2",fontSize:13,lineHeight:20,marginTop:9},
 panel:{backgroundColor:"#121f1a",borderColor:"#2c493b",borderWidth:1,borderRadius:16,padding:16,marginBottom:14},sectionTitle:{color:"#eef5f1",fontWeight:"800",fontSize:16,marginBottom:12},label:{color:"#9fb5a8",fontSize:11,fontWeight:"700",marginBottom:6},input:{backgroundColor:"#0b1510",borderColor:"#345344",borderWidth:1,borderRadius:9,color:"#f1f7f3",paddingHorizontal:12,paddingVertical:11,fontSize:14},
 row:{flexDirection:"row",gap:9,marginTop:11},portBox:{width:100},pinBox:{flex:1},statusRow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:14},dot:{width:8,height:8,borderRadius:4},status:{color:"#d5e4db",fontSize:12},error:{color:"#ff9b91",fontSize:12,marginTop:8,lineHeight:17},
 primary:{backgroundColor:"#16865b",borderRadius:10,alignItems:"center",padding:13,marginTop:14},primaryText:{color:"#fff",fontWeight:"800",fontSize:14},hint:{color:"#9fb5a8",fontSize:11,lineHeight:17},
 touchpad:{height:190,backgroundColor:"#0b1510",borderColor:"#47735c",borderWidth:1,borderRadius:13,alignItems:"center",justifyContent:"center",marginTop:10},touchText:{color:"#a8e8c0",fontWeight:"900",letterSpacing:2,marginBottom:8},
 action:{flex:1,backgroundColor:"#20372c",borderRadius:9,padding:12,alignItems:"center"},actionText:{color:"#d9eee1",fontWeight:"700",fontSize:11},keyButton:{flex:1,backgroundColor:"#20372c",borderRadius:8,padding:10,alignItems:"center"},
 features:{marginTop:8},feature:{flexDirection:"row",gap:9,marginBottom:8},featureMark:{color:"#79d6a5",fontSize:17},featureText:{color:"#c1d1c8",fontSize:12},fileRow:{flexDirection:"row",alignItems:"center",gap:8,borderTopWidth:1,borderTopColor:"#2c493b",paddingVertical:10},fileName:{color:"#e4f1e9",fontSize:12,fontWeight:"700"},downloadButton:{backgroundColor:"#20372c",padding:10,borderRadius:8},transferStatus:{color:"#9ce2bb",fontSize:11,marginTop:10},footer:{color:"#82958b",fontSize:10,textAlign:"center",marginTop:13}
});
