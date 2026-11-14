using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

internal static class Program
{
    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008, MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020, MOUSEEVENTF_MIDDLEUP = 0x0040;
    private const uint MOUSEEVENTF_WHEEL = 0x0800;
    private const uint KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_UNICODE = 0x0004;
    private const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;

    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public InputUnion U; }
    [StructLayout(LayoutKind.Explicit)] private struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }

    [DllImport("user32.dll", SetLastError=true)] private static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll", SetLastError=true)] private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int nIndex);

    private static INPUT Mouse(uint flags, uint data=0) => new() { type=INPUT_MOUSE, U=new InputUnion { mi=new MOUSEINPUT { dwFlags=flags, mouseData=data } } };
    private static INPUT Key(ushort vk, bool up=false) => new() { type=INPUT_KEYBOARD, U=new InputUnion { ki=new KEYBDINPUT { wVk=vk, dwFlags=up ? KEYEVENTF_KEYUP : 0 } } };
    private static void Click(string button, bool down)
    {
        uint flag = button switch { "left" => down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP, "right" => down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP, "middle" => down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP, _ => throw new ArgumentException("Unsupported mouse button") };
        SendInput(1, new[] { Mouse(flag) }, Marshal.SizeOf<INPUT>());
    }
    private static ushort KeyCode(string key) => key.ToLowerInvariant() switch
    {
        "enter" => 0x0D, "escape" => 0x1B, "backspace" => 0x08, "tab" => 0x09, "space" => 0x20,
        "delete" => 0x2E, "home" => 0x24, "end" => 0x23, "pageup" => 0x21, "pagedown" => 0x22,
        "up" => 0x26, "down" => 0x28, "left" => 0x25, "right" => 0x27,
        "shift" => 0x10, "ctrl" => 0x11, "alt" => 0x12, "meta" => 0x5B,
        _ when key.Length == 1 && char.IsLetterOrDigit(key[0]) => (ushort)char.ToUpperInvariant(key[0]),
        _ => throw new ArgumentException("Unsupported key")
    };
    private static void TypeText(string text)
    {
        if (text.Length > 4000) throw new ArgumentException("Text is too long");
        var inputs = new List<INPUT>(text.Length * 2);
        foreach (char ch in text)
        {
            inputs.Add(new INPUT { type=INPUT_KEYBOARD, U=new InputUnion { ki=new KEYBDINPUT { wScan=ch, dwFlags=KEYEVENTF_UNICODE } } });
            inputs.Add(new INPUT { type=INPUT_KEYBOARD, U=new InputUnion { ki=new KEYBDINPUT { wScan=ch, dwFlags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP } } });
        }
        if (inputs.Count > 0) SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf<INPUT>());
    }
    private static void Handle(JsonElement msg)
    {
        string type = msg.GetProperty("type").GetString() ?? "";
        switch (type)
        {
            case "mouseMove":
                int x = Math.Clamp(msg.GetProperty("x").GetInt32(), 0, Math.Max(0, GetSystemMetrics(0)-1));
                int y = Math.Clamp(msg.GetProperty("y").GetInt32(), 0, Math.Max(0, GetSystemMetrics(1)-1));
                SetCursorPos(x, y); break;
            case "mouseButton":
                string button = msg.GetProperty("button").GetString() ?? "left";
                Click(button, msg.GetProperty("down").GetBoolean()); break;
            case "mouseScroll":
                int delta = Math.Clamp(msg.GetProperty("delta").GetInt32(), -1200, 1200);
                SendInput(1, new[] { Mouse(MOUSEEVENTF_WHEEL, unchecked((uint)delta)) }, Marshal.SizeOf<INPUT>()); break;
            case "key":
                ushort vk = KeyCode(msg.GetProperty("key").GetString() ?? "");
                bool down = msg.GetProperty("down").GetBoolean();
                SendInput(1, new[] { Key(vk, !down) }, Marshal.SizeOf<INPUT>()); break;
            case "text":
                TypeText(msg.GetProperty("text").GetString() ?? ""); break;
            default: throw new ArgumentException("Unknown input command");
        }
    }
    public static void Main()
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;
        string? line;
        while ((line = Console.ReadLine()) != null)
        {
            try { using var doc = JsonDocument.Parse(line); Handle(doc.RootElement); Console.WriteLine("{\"ok\":true}"); }
            catch (Exception ex) { Console.WriteLine(JsonSerializer.Serialize(new { ok=false, error=ex.Message })); }
        }
    }
}
