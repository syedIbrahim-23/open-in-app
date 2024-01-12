import path from "path";
import { authenticate } from "@google-cloud/local-auth";
import { LABEL_NAME, MAIL_BODY, SCOPE_URLS } from "../common/constansts.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { google } from "googleapis";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let mailInterval;

export const responseToMail = async (req, res) => {
  try {
    const auth = await authenticateUser();
    console.log("Auth",JSON.stringify(auth));
    const gmailRes = google.gmail({ version: "v1", auth:auth });
    await checkAndRespondToMail(auth, gmailRes);
  } catch (error) {
    console.error("Error in responseToMail", error);
  }
};

const authenticateUser = async () => {
  try {
    const auth = await authenticate({
      keyfilePath: path.join(__dirname, "credentials.json"),
      scopes: SCOPES,
    });
    return auth
  } catch (error) {
    console.error("Error in Authentication", error);
  }
};

const getUnrepliesMessages = async (gmail) => {
  console.log("Get Unreplies Messages got hitted");
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    q: "-in:chats -from:me -has:userlabels",
  });
  return response.data.messages || [];
};

const addLabel = async (auth, message, labelId) => {
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.modify({
    userId: "me",
    id: message.id,
    requestBody: {
      addLabelIds: [labelId],
      removeLabelIds: ["INBOX"],
    },
  });
};

const createLabel = async (gmail) => {
  console.log("Create label got hitted");

  try {
    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: LABEL_NAME,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    return response.data.id;
  } catch (error) {
    if (error.code === 409) {
      const response = await gmail.users.labels.list({
        userId: "me",
      });
      const label = response.data.labels.find(
        (label) => label.name === LABEL_NAME
      );
      return label.id;
    } else {
      throw error;
    }
  }
};

const sendReply = async (gmail, message) => {
  console.log("SendReply got hitted");

  try {
    const result = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From"],
    });

    const subject = result.data.payload.headers.find(
      (header) => header.name === "Subject"
    ).value;
    const from = result.data.payload.headers.find(
      (header) => header.name === "From"
    ).value;

    const replyTo = from.match(/<(.*)>/)[1];
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    const replyBody = MAIL_BODY;

    const rawMessage = [
      `From: me`,
      `To: ${replyTo}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${message.id}`,
      `References: ${message.id}`,
      "",
      replyBody,
    ].join("\n");

    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });
  } catch (error) {
    console.error("Error in sendReply", error);
  }
};

const checkAndRespondToMail = async (auth, gmail) => {
  const randomInterval = Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000; // Random interval between 45 and 120 seconds
  const response = await gmail.users.labels.list({ userId: "me" });
  const labelId = await createLabel(gmail);
  console.log(`Label has been created  ${labelId}`);
  if (mailInterval) {
    clearInterval(mailInterval);
  }
  mailInterval = setInterval(async () => {
    const messages = await getUnrepliesMessages(gmail);
    console.log(`found ${messages.length} unreplied messages`);

    for (const message of messages) {
      await sendReply(gmail, message);
      console.log(`sent reply to message with id ${message.id}`);

      await addLabel(auth, message, labelId);
      console.log(`Added label to message with id ${message.id}`);
    }
  }, randomInterval);
};
