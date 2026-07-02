export const IG_GRAPH_API_VERSION = "v22.0";
// "Instagram API with Instagram Login" tokens are only valid against
// graph.instagram.com. Using graph.facebook.com with those tokens returns
// "Invalid OAuth access token - Cannot parse access token".
export const IG_GRAPH_BASE_URL = `https://graph.instagram.com/${IG_GRAPH_API_VERSION}`;
