using System;
using System.Net;
using System.IO;
using System.Threading;

class SimpleWebServer {
    static void Main() {
        HttpListener listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:8080/");
        listener.Start();
        Console.WriteLine("Server started on http://localhost:8080/");
        
        while (true) {
            HttpListenerContext context = listener.GetContext();
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;
            
            string path = request.Url.AbsolutePath;
            if (path == "/") path = "/index.html";
            string filePath = "." + path.Replace("/", "\\");
            
            try {
                byte[] buffer = File.ReadAllBytes(filePath);
                response.ContentLength64 = buffer.Length;
                
                if (path.EndsWith(".js")) response.ContentType = "application/javascript";
                else if (path.EndsWith(".css")) response.ContentType = "text/css";
                else if (path.EndsWith(".html")) response.ContentType = "text/html";
                
                Stream output = response.OutputStream;
                output.Write(buffer, 0, buffer.Length);
                output.Close();
            } catch (Exception) {
                response.StatusCode = 404;
                response.Close();
            }
        }
    }
}
