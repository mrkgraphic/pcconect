using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

internal static class Program
{
    private const uint MOUSEEVENTF_MOVE=0x0001, MOUSEEVENTF_LEFTDOWN=0x0002, MOUSEEVENTF_LEFTUP=0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN=0x0008, MOUSEEVENTF_RIGHTUP=0x0010, MOUSEEVENTF_MIDDLEDOWN=0x0020, MOUSEEVENTF_MIDDLEUP=0x0040;
    private const uint MOUSEEVENTF_WHEEL=0x0800, KEYEVENTF_KEYUP=0x0002, KEYEVENTF_UNICODE=0x0004;
    private const uint INPUT_MOUSE=0, INPUT_KEYBOARD=1;
    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public InputUnion U; }
    [StructLayout(LayoutKind.Explicit)] private struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT { public ushort wVk,wScan; public uint dwFlags,time; public IntPtr dwExtraInfo; }
    [DllImport("user32.dll",SetLastError=true)] private static extern uint SendInput(uint nInputs,INPUT[] pInputs,int cbSize);
    private static void Send(INPUT[] inputs)
    {
        uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
        if (sent != inputs.Length)
            throw new InvalidOperationException($"SendInput accepted {sent} of {inputs.Length} events (Win32 error {Marshal.GetLastWin32Error()}).");
    }
    private static INPUT Mouse(uint flags,uint data=0,int dx=0,int dy=0)=>new(){type=INPUT_MOUSE,U=new InputUnion{mi=new MOUSEINPUT{dx=dx,dy=dy,dwFlags=flags,mouseData=data}}};
    private static INPUT Key(ushort vk,bool up=false)=>new(){type=INPUT_KEYBOARD,U=new InputUnion{ki=new KEYBDINPUT{wVk=vk,dwFlags=up?KEYEVENTF_KEYUP:0}}};
    private static void Click(string b,bool down){uint f=b switch{"left"=>down?MOUSEEVENTF_LEFTDOWN:MOUSEEVENTF_LEFTUP,"right"=>down?MOUSEEVENTF_RIGHTDOWN:MOUSEEVENTF_RIGHTUP,"middle"=>down?MOUSEEVENTF_MIDDLEDOWN:MOUSEEVENTF_MIDDLEUP,_=>throw new ArgumentException("Unsupported mouse button")};Send(new[]{Mouse(f)});}
    private static ushort KeyCode(string k)=>k.ToLowerInvariant() switch{"enter"=>0x0D,"escape"=>0x1B,"backspace"=>0x08,"tab"=>0x09,"space"=>0x20,"delete"=>0x2E,"home"=>0x24,"end"=>0x23,"pageup"=>0x21,"pagedown"=>0x22,"up"=>0x26,"down"=>0x28,"left"=>0x25,"right"=>0x27,"shift"=>0x10,"ctrl"=>0x11,"alt"=>0x12,"meta"=>0x5B,_ when k.Length==1&&char.IsLetterOrDigit(k[0])=>(ushort)char.ToUpperInvariant(k[0]),_=>throw new ArgumentException("Unsupported key")};
    private static void TypeText(string s){if(s.Length>4000)throw new ArgumentException("Text too long");var a=new List<INPUT>(s.Length*2);foreach(char c in s){a.Add(new INPUT{type=INPUT_KEYBOARD,U=new InputUnion{ki=new KEYBDINPUT{wScan=c,dwFlags=KEYEVENTF_UNICODE}}});a.Add(new INPUT{type=INPUT_KEYBOARD,U=new InputUnion{ki=new KEYBDINPUT{wScan=c,dwFlags=KEYEVENTF_UNICODE|KEYEVENTF_KEYUP}}});}if(a.Count>0)Send(a.ToArray());}
    private static void Handle(JsonElement m){switch(m.GetProperty("type").GetString()){case "mouseMove":int x=Math.Clamp(m.GetProperty("x").GetInt32(),-300,300);int y=Math.Clamp(m.GetProperty("y").GetInt32(),-300,300);Send(new[]{Mouse(MOUSEEVENTF_MOVE,0,x,y)});break;case "mouseButton":Click(m.GetProperty("button").GetString()??"left",m.GetProperty("down").GetBoolean());break;case "mouseScroll":int d=Math.Clamp(m.GetProperty("delta").GetInt32(),-1200,1200);Send(new[]{Mouse(MOUSEEVENTF_WHEEL,unchecked((uint)d))});break;case "key":Send(new[]{Key(KeyCode(m.GetProperty("key").GetString()??""),!m.GetProperty("down").GetBoolean())});break;case "text":TypeText(m.GetProperty("text").GetString()??"");break;default:throw new ArgumentException("Unknown input command");}}
    public static void Main(){Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=Encoding.UTF8;Console.WriteLine("{\"ready\":true}");string? line;while((line=Console.ReadLine())!=null){try{using var d=JsonDocument.Parse(line);Handle(d.RootElement);Console.WriteLine("{\"ok\":true}");}catch(Exception e){Console.WriteLine(JsonSerializer.Serialize(new{ok=false,error=e.Message}));}}}
}
