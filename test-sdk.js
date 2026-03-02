const { fal } = require('@fal-ai/serverless-client');

async function debugFal() {
  const FAL_KEY = "ebcbcd17-6b6e-4093-b344-bc64edd3591e:52775e23c3e5c4dc9934179e5bcafc15";
  fal.config({ credentials: FAL_KEY });

  try {
    const result = await fal.subscribe("fal-ai/idm-vton", {
      input: {
        human_image_url: "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png",
        garment_image_url: "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png",
        category: "top"
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(update);
        }
      }
    });

    console.log("FINAL RESULT SCHEMA:", JSON.stringify(result, null, 2));
  } catch(e) {
    console.error("FAL SDK ERROR:", e);
  }
}

debugFal();
