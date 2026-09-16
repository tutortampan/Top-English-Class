using System;
using System.IO;
using System.Text;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        var dict = new Dictionary<string, string>
        {
            {"â€”", "—"},
            {"â†’", "→"},
            {"ðŸ’¾", "💾"},
            {"ðŸ“¥", "📥"},
            {"ðŸ“¤", "📤"},
            {"ðŸ“Š", "📊"},
            {"ðŸ› ï¸ ", "🛠️"},
            {"âš¡", "⚡"},
            {"ðŸ”„", "🔄"},
            {"ðŸ ›ï¸ ", "🏛️"},
            {"ðŸ‘¤", "👤"},
            {"ðŸ“„", "📄"},
            {"ðŸŽ™ï¸ ", "🎙️"},
            {"ðŸ”˜", "🔘"},
            {"ðŸ‘¥", "👥"},
            {"ðŸ“ ", "📉"},
            {"ðŸŸ¢", "🟢"},
            {"ðŸš§", "🚧"},
            {"ðŸ”€", "🔀"},
            {"âž¡ï¸ ", "➡️"},
            {"â ±ï¸ ", "⏱️"},
            {"ðŸŽ¯", "🎯"},
            {"ðŸ”½", "🔽"},
            {"ðŸŒ ", "🌍"},
            {"ðŸ”’", "🔒"},
            {"ðŸ—‘ï¸ ", "🗑️"},
            {"ðŸ“œ", "📜"},
            {"ðŸ” ", "🔍"},
            {"ðŸ‘¨", "👨"},
            {"ðŸ‘©", "👩"},
            {"âœ“", "✓"}
        };

        string dir = Directory.GetCurrentDirectory();
        string[] exts = { "*.js", "*.css", "*.html" };
        foreach (string ext in exts)
        {
            string[] files = Directory.GetFiles(dir, ext, SearchOption.AllDirectories);
            foreach (string file in files)
            {
                if (file.Contains("\\node_modules\\") || file.Contains("\\.git\\")) continue;
                
                string content = File.ReadAllText(file, Encoding.UTF8);
                bool changed = false;
                foreach (var kvp in dict)
                {
                    if (content.Contains(kvp.Key))
                    {
                        content = content.Replace(kvp.Key, kvp.Value);
                        changed = true;
                    }
                }
                if (changed)
                {
                    File.WriteAllText(file, content, Encoding.UTF8);
                    Console.WriteLine("Fixed: " + file);
                }
            }
        }
    }
}
