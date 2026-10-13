const fs = require("fs");
require("dotenv").config({ path: ".env.production" });
var url = process.env.QWEN_API_URL;
var key = process.env.QWEN_API_KEY;
var b64 = fs.readFileSync("public/android-chrome-512x512.png").toString("base64");
var img = { type: "image_url", image_url: { url: "data:image/png;base64," + b64 } };
var txt = { type: "text", text: "describe this image briefly" };
var msgs = [{ role: "user", content: [txt, img] }];
var h = { Authorization: "Bearer " + key, "Content-Type": "application/json" };

async function run(label, extra) {
  var b = Object.assign({ model: "qwen3-vl-plus", max_tokens: 500, messages: msgs }, extra);
  var t0 = Date.now();
  try {
    var r = await fetch(url + "/chat/completions", { method: "POST", headers: h, body: JSON.stringify(b) });
    var j = await r.json();
    var ms = Date.now() - t0;
    var m = j.choices && j.choices[0] && j.choices[0].message;
    var rc = m && m.reasoning_content ? (m.reasoning_content + "").length : -1;
    console.log(label, "| status", r.status, "| ms", ms, "| reasoning_len", rc);
    if (r.status !== 200) console.log(JSON.stringify(j).slice(0, 300));
  } catch (e) {
    console.log(label, "ERR", String(e));
  }
}

async function main() {
  await run("think-on ", {});
  await run("think-off", { enable_thinking: false, chat_template_kwargs: { enable_thinking: false } });
}
main();
