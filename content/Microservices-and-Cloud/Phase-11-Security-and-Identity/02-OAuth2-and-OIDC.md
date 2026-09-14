# OAuth 2.0 and OpenID Connect (OIDC)

When building a modern application, you rarely want to handle passwords yourself. Building a secure login system that handles hashing, password resets, and MFA is difficult and risky.

Instead, modern applications rely on Identity Providers (IdP) like Google, Auth0, or Okta. To communicate with these providers securely, we use standard protocols: **OAuth 2.0** and **OpenID Connect (OIDC)**.

## 1. OAuth 2.0 (Authorization)

**OAuth 2.0 is an authorization protocol, not an authentication protocol.**

It was designed to answer the question: *"How can I grant Application A access to my data in Application B, without giving Application A my password?"*

**Example:** You want to let a printing website access your Google Drive to print a document.
1. You click "Import from Google Drive" on the printing website.
2. You are redirected to Google's login page. 
3. Google asks: "Do you want to grant the Printing Website read access to your Drive?"
4. You click "Yes".
5. Google gives the Printing Website an **Access Token**.
6. The Printing Website uses that Access Token to download your document.

At no point did the printing website ever see your Google password. 

### The Flaw with OAuth 2.0 for Login
OAuth 2.0 only provides an Access Token (which is essentially a keycard). The Access Token does not contain any information about *who* the user is (their name, email). Developers started misusing OAuth 2.0 as a login protocol, leading to massive security vulnerabilities.

## 2. OpenID Connect (Authentication)

OpenID Connect (OIDC) is an authentication layer built *on top* of OAuth 2.0. 

It was designed to answer the question: *"Who is the user that just logged in?"*

When a user logs in via OIDC (e.g., clicking "Log in with Google"), the Identity Provider issues the standard Access Token (for authorization), but it also issues a **ID Token**.

### The ID Token
The ID Token is always a **JSON Web Token (JWT)**. It contains verifiable information about the user's identity.

```json
{
  "sub": "1234567890", // The user's unique ID
  "name": "John Doe",
  "email": "john.doe@example.com",
  "iss": "https://accounts.google.com", // Who issued this token
  "exp": 1698765432 // When this token expires
}
```

The application can read this ID token to instantly know the user's name and email, securely proving their identity.

## Summary
- **Authentication** = Who are you? (Identity)
- **Authorization** = What are you allowed to do? (Permissions)
- **OAuth 2.0** is strictly for Authorization (Access Tokens).
- **OpenID Connect (OIDC)** is an extension of OAuth 2.0 used for Authentication (ID Tokens).
