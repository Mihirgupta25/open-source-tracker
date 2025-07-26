'use strict';

// Basic authentication for dev environment
// Username: dev
// Password: tracker2024

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    
    // Skip authentication for API calls and static assets
    if (request.uri.startsWith('/api/') || 
        request.uri.includes('.') || 
        request.uri === '/favicon.ico') {
        return request;
    }
    
    // Check for Authorization header
    const authHeader = headers.authorization ? headers.authorization[0].value : '';
    
    if (authHeader) {
        // Extract credentials from Authorization header
        const credentials = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
        const [username, password] = credentials.split(':');
        
        // Check credentials (dev/tracker2024)
        if (username === 'dev' && password === 'tracker2024') {
            return request;
        }
    }
    
    // Return 401 Unauthorized with basic auth prompt
    return {
        status: '401',
        statusDescription: 'Unauthorized',
        headers: {
            'www-authenticate': [{
                key: 'WWW-Authenticate',
                value: 'Basic realm="Dev Environment"'
            }],
            'content-type': [{
                key: 'Content-Type',
                value: 'text/html'
            }]
        },
        body: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Required</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .container { max-width: 400px; margin: 0 auto; }
                .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>🔒 Dev Environment Access</h2>
                <div class="error">
                    <p><strong>Authentication Required</strong></p>
                    <p>This is a protected development environment.</p>
                    <p>Please enter your credentials to continue.</p>
                </div>
                <p><small>Contact your administrator for access credentials.</small></p>
            </div>
        </body>
        </html>
        `
    };
}; 