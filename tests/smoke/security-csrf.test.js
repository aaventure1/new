process.env.NODE_ENV = 'test';
process.env.BASE_URL = 'https://aaventure.example';

const request = require('supertest');
const { app } = require('../../server/index');

describe('Security origin checks', () => {
    it('blocks unsafe cross-origin API writes', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Origin', 'https://evil.example')
            .send({ email: 'x@example.com', password: 'bad' });

        if (res.status !== 403) {
            throw new Error(`Expected 403, got ${res.status}`);
        }
    });
});
