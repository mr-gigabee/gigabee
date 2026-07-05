# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| latest (main) | ✅ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues by email to **security@gigabee.io**. Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested remediation

You will receive an acknowledgement within 48 hours and a detailed response within 7 days.

## Scope

In scope:
- Authentication bypass or session hijacking
- Credit balance manipulation or billing exploits
- Worker payment fraud (earning credits without serving valid jobs)
- Data exposure — user emails, session tokens, Solana addresses
- API endpoint injection or privilege escalation

Out of scope:
- Rate limit bypasses with no financial impact
- Self-XSS (requires the attacker to already control the browser)
- Clickjacking on pages that require authentication
- Issues in third-party dependencies already reported upstream

## Responsible disclosure

We ask that you give us a reasonable window to address the issue before any public disclosure. We will credit researchers who report valid vulnerabilities, with your permission.
