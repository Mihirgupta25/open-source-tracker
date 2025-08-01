# Security Documentation

## Staging Environment Authentication

### Overview
The staging environment is protected with HTTP Basic Authentication to ensure only authorized users can access it.

### Credential Management

#### Current Setup
- **Username**: `staging`
- **Password**: Stored securely in AWS Secrets Manager
- **Authentication Method**: Hash-based comparison in Lambda@Edge

#### Security Features

1. **No Hardcoded Credentials**: 
   - Passwords are never stored in plain text in the codebase
   - Only password hashes are stored in the authentication function
   - Actual credentials are stored in AWS Secrets Manager

2. **Secure Storage**:
   - Credentials are stored in AWS Secrets Manager (`staging-credentials`)
   - Access is restricted to authorized AWS users/roles
   - Credentials can be rotated without code changes

3. **Hash-Based Authentication**:
   - Password comparison uses a simple hash function
   - Plain text passwords are never stored in the Lambda function
   - Hash values are not reversible to plain text

### Updating Credentials

To update staging credentials:

1. **Update AWS Secrets Manager**:
   ```bash
   aws secretsmanager update-secret --secret-id staging-credentials --secret-string '{"username":"new_username","password":"new_password"}'
   ```

2. **Deploy Updated Authentication**:
   ```bash
   node scripts/deploy-staging-auth.js
   ```

### Security Best Practices

1. **Never commit credentials to Git**:
   - All credential files are in `.gitignore`
   - Use AWS Secrets Manager for credential storage
   - Rotate credentials regularly

2. **Access Control**:
   - Only you have access to the staging environment
   - Credentials are managed through AWS IAM
   - CloudFront distribution is protected with Lambda@Edge

3. **Monitoring**:
   - Failed authentication attempts are logged
   - CloudWatch logs track access patterns
   - AWS CloudTrail logs credential access

### Files to Never Commit

The following files contain sensitive information and should never be committed:

- `backend/.env` - Contains GitHub tokens
- `scripts/deploy-staging-auth.js` - Contains staging authentication deployment
- Any files with `*credentials*`, `*secret*`, `*password*`, `*key*` in the name
- AWS credential files (`.aws/`, `*.pem`, `*.key`)

### Emergency Access

If you need to change credentials immediately:

1. Update the secret in AWS Secrets Manager
2. Run the update script: `node scripts/deploy-staging-auth.js`
3. The changes will propagate within a few minutes

### Staging Environment URL
- **URL**: `https://d1j9ixntt6x51n.cloudfront.net`
- **Authentication**: HTTP Basic Auth
- **Access**: Restricted to authorized users only 