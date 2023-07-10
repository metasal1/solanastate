import OAuth from 'oauth-1.0a';
import { config } from './config.js';
import crypto from 'crypto';

const access_token = config.access_token;
const access_token_secret = config.access_token_secret;
const consumer_key = config.consumer_api_key
const consumer_secret = config.consumer_api_secret;

const endpointURL = `https://api.twitter.com/2/tweets`;

const oauth = OAuth({
    consumer: {
        key: consumer_key,
        secret: consumer_secret
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64')
});

async function getRequest(token, tweet) {
    const authHeader = oauth.toHeader(oauth.authorize({
        url: endpointURL,
        method: 'POST'
    }, token));

    const req = await fetch(endpointURL, {
        method: 'POST',
        headers: {
            'Authorization': authHeader["Authorization"],
            'content-type': "application/json",
            'accept': "application/json"
        },
        body: JSON.stringify({ "text": tweet })
    });

    const res = await req.json();
    return res
}

export default async function tweeter(tweet) {
    try {
        // Get user token and secret
        const userToken = {
            key: access_token,
            secret: access_token_secret
        };
        // Make the request
        const res = await getRequest(userToken, tweet);
        console.log(res);
        return res;
    } catch (e) {
        console.dir(e);
    }
}

// tweeter("Hello World");