const {GoogleAuth} = require('google-auth-library');
const axios = require('axios');
const SERVICE_ACCOUNT_FILE = './service-account.json';
const DEVICE_TOKEN = 'cD8vGksTQbS3k-OQA3bhtE:APA91bFiuXVtD2_97Qfo7vWBX94LUvEm0dKd76U9WEx90126g8cq8gpJoM8c32ri3OXGZ-XxjKSE3bU0aHrL1ZvrePZLDlCYcUho50adN9rrCnfBjjPhkb4';

// Development-only script for sending a test FCM data message to one device token.

async function getAccessToken() {
    const auth = new GoogleAuth({
        keyFile: SERVICE_ACCOUNT_FILE,
        scopes: 'https://www.googleapis.com/auth/firebase.messaging'
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
}

async function sendMessage() {
    const accessToken = await getAccessToken();
    const message = {
        message: {
            token: DEVICE_TOKEN,
            data: {
                type: 'focus_alert',
                title: 'Focus Alert',
                body:'Overlay Should Appear',
            },
            android:{
                priority: 'high',
            },   
        },
    };
    const projectId = require(SERVICE_ACCOUNT_FILE).project_id;
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    try{
        const response = await axios.post(url, message, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": 'application/json',
            },
        });
        console.log("SUCCESS");
        console.log(response.data);

    } catch (err){
        console.log("ERROR");
        console.error(err.response?.data || err.message);
    }

}

sendMessage();