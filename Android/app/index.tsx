import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type PairResult = { type: "pairResult"; accepted: boolean; sessionToken?: string };
const DEFAULT_PORT = "47831";

export default function HomeScreen() {
  const [address,setAddress]=useState(""); const [port,setPort]=useState(DEFAULT_PORT); const [pin,setPin]=useState("");
  const [status,setStatus]=useState("Not connected"); const [error,setError]=useState(""); const [paired,setPaired]=useState(false);
  const [draft,setDraft]=useState("");
  const socket=useRef<WebSocket|null>(null); const token=useRef<string|null>(null); const last=useRef({x:0,y:0}); const moved=useRef(false);

  const sendCommand=(command:Record<string,unknown>)=>{
    if(socket.current?.readyState===WebSocket.OPEN && token.current) socket.current.send(JSON.stringify({...command,sessionToken:token.current}));
  };
  const touchpad=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:()=>{last.current={x:0,y:0};moved.current=false;},
    onPanResponderMove:(_,g)=>{
      const dx=g.dx-last.current.x,dy=g.dy-last.current.y;last.current={x:g.dx,y:g.dy};
      if(Math.abs(g.dx)+Math.abs(g.dy)>3)moved.current=true;
      if(paired && (dx!==0||dy!==0))sendCommand({type:"mouseMove",x:Math.round(dx*1.8),y:Math.round(dy*1.8)});
    },
    onPanResponderRelease:()=>{
      if(!moved.current && paired)sendCommand({type:"mouseButton",button:"left",down:true}),sendCommand({type:"mouseButton",button:"left",down:false});
    }
  })).current;

  useEffect(()=>()=>{socket.current?.close();},[]);
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
  const disconnect=()=>{socket.current?.close();socket.current=null;token.current=null;setPaired(false);setStatus("Disconnected");};
  const sendText=()=>{if(draft.trim()){sendCommand({type:"text",text:draft});setDraft("");}};
  const key=(name:string)=>{sendCommand({type:"key",key:name,down:true});sendCommand({type:"key",key:name,down:false});};

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
        <View {...touchpad.panHandlers} style={styles.touchpad}><Text style={styles.touchText}>TOUCHPAD</Text><Text style={styles.hint}>Move · Tap to click</Text></View>
        <View style={styles.row}><Pressable style={styles.action} onPress={()=>{sendCommand({type:"mouseButton",button:"left",down:true});sendCommand({type:"mouseButton",button:"left",down:false});}}><Text style={styles.actionText}>Left Click</Text></Pressable><Pressable style={styles.action} onPress={()=>{sendCommand({type:"mouseButton",button:"right",down:true});sendCommand({type:"mouseButton",button:"right",down:false});}}><Text style={styles.actionText}>Right Click</Text></Pressable></View>
        <View style={styles.row}><Pressable style={styles.action} onPress={()=>sendCommand({type:"mouseScroll",delta:480})}><Text style={styles.actionText}>Scroll Up</Text></Pressable><Pressable style={styles.action} onPress={()=>sendCommand({type:"mouseScroll",delta:-480})}><Text style={styles.actionText}>Scroll Down</Text></Pressable></View>
        <Text style={[styles.sectionTitle,{marginTop:18}]}>Keyboard / Text</Text><TextInput value={draft} onChangeText={setDraft} placeholder="Type text to send to focused PC app" placeholderTextColor="#71857a" style={styles.input} multiline/>
        <Pressable onPress={sendText} style={styles.primary}><Text style={styles.primaryText}>Send Text to PC</Text></Pressable>
        <View style={styles.row}>{["enter","backspace","tab","escape"].map(k=><Pressable key={k} onPress={()=>key(k)} style={styles.keyButton}><Text style={styles.actionText}>{k.toUpperCase()}</Text></Pressable>)}</View>
      </View>}
      <View style={styles.features}><Text style={styles.sectionTitle}>More features in development</Text>{["Voice typing with preview","Restricted two-way file transfer","PC audio on phone speaker","Automatic PC discovery and QR pairing"].map(item=><View key={item} style={styles.feature}><Text style={styles.featureMark}>•</Text><Text style={styles.featureText}>{item}</Text></View>)}</View>
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
 features:{marginTop:8},feature:{flexDirection:"row",gap:9,marginBottom:8},featureMark:{color:"#79d6a5",fontSize:17},featureText:{color:"#c1d1c8",fontSize:12},footer:{color:"#82958b",fontSize:10,textAlign:"center",marginTop:13}
});
