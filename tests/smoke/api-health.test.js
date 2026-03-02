process.env.NODE_ENV = 'test';
process.env.BASE_URL = 'https://aaventure.example';

const request = require('supertest');
const { app } = require('../../server/index');

describe('API health', () => {
    it('returns health payload', async () => {
        const res = await request(app).get('/api/health');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.body || res.body.status !== 'ok') throw new Error('Expected status=ok');
    });
});
