const JWKS = {
    keys: [
        {
            kty: 'RSA',
            kid: 'trouvable-discovery-key-1',
            use: 'sig',
            alg: 'RS256',
            n: 'oahUIzM0kI3dM0Gf4bmP4j2Q9E4hQ9nM5Q8N8SxD8k7Y5gQPrm2bQ4y3m7W0b4f7x3e6E5h2u6f9F2a4c8D1y9t7E2u3c1q4r7L8m9N3p2s4t6v8w0x1y2z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7P8Q9R0S1T2U3V4W5X6Y7Z8',
            e: 'AQAB',
        },
    ],
};

export function GET() {
    return Response.json(JWKS, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
