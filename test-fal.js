const fetch = require('node-fetch');
const fs = require('fs');

async function debugFalResponse() {
  const FAL_KEY = "ebcbcd17-6b6e-4093-b344-bc64edd3591e:52775e23c3e5c4dc9934179e5bcafc15";
  
  try {
    const submitRes = await fetch("https://queue.fal.run/fal-ai/idm-vton", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        human_image_url: "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png",
        garment_image_url: "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png",
        category: "top",
        crop: false
      })
    });
    
    const { request_id } = await submitRes.json();
    console.log("Got request_id:", request_id);
    
    let isCompleted = false;
    while (!isCompleted) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://queue.fal.run/fal-ai/idm-vton/requests/${request_id}/status`, {
        headers: { "Authorization": `Key ${FAL_KEY}` }
      });
      const statusData = await statusRes.json();
      console.log("Status:", statusData.status);
      
      if (statusData.status === "COMPLETED") {
        isCompleted = true;
        fs.writeFileSync("fal-response.json", JSON.stringify(statusData, null, 2));
        console.log("Wrote fal-response.json");
      }
    }
  } catch (e) {
    console.error(e);
  }
}

debugFalResponse();
