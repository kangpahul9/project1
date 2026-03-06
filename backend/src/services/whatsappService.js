import axios from "axios";

export async function sendWhatsAppTemplate(templateName, params) {
  try {

    const components = [
      {
        type: "body",
        parameters: params.map(p => ({
          type: "text",
          text: String(p)
        }))
      }
    ];

    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: process.env.WHATSAPP_OWNER_PHONE,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          components
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("WhatsApp template sent:", response.data);

    return true;

  } catch (err) {
    console.error(
      "WhatsApp error:",
      err.response?.data || err.message
    );

    return false;
  }
}