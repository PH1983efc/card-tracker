import { google } from "googleapis";

export const handler = async () => {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );

    await auth.authorize();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Google auth works!" })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Google auth FAILED",
        error: error.message
      })
    };
  }
};

