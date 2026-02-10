interface Env {
  MY_BUCKET: R2Bucket; // อย่าลืมสร้าง R2 Bucket และ Bind ในหน้า Dashboard
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // 1. ปรับ CORS ให้รองรับ Authorization และ GET
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- ส่วนที่ 1: บอร์ดส่งรูปเข้ามา (POST /upload) ---
    if (request.method === "POST" && url.pathname === "/upload") {
      const auth = request.headers.get("Authorization");
      if (auth !== "Bearer Board-Secret-123") { // รหัสที่บอร์ดต้องส่งมา
        return new Response("Unauthorized", { status: 401 });
      }

      const imageData = await request.arrayBuffer();
      // เก็บลง R2 (ไฟล์ชื่อเดียวเพื่อเขียนทับภาพล่าสุด)
      await env.MY_BUCKET.put("latest.jpg", imageData);
      
      return new Response("Uploaded!", { headers: corsHeaders });
    }

    // --- ส่วนที่ 2: Login (POST /login) ---
    if (request.method === "POST" && url.pathname === "/login") {
      const { username, password } = await request.json() as any;
      
      if (username === "admin" && password === "admin") {
        return new Response(JSON.stringify({
          success: true,
          token: "FAKE_TOKEN_ABC123"
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      
      return new Response(JSON.stringify({ success: false, message: "Invalid credentials" }), 
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // --- ส่วนที่ 3: ดึงรูปไปแสดงผล (GET /photo) ---
    if (request.method === "GET" && url.pathname === "/photo") {
      const object = await env.MY_BUCKET.get("latest.jpg");
      
      if (!object) {
        return new Response("No image found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers); 
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Content-Type", "image/jpeg");

      return new Response(object.body, { headers });
    }

    return new Response("Not Found", { status: 404 });
  }
};
