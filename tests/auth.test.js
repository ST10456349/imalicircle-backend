// tests/auth.test.js
// Basic input-validation unit tests that don't require a live database connection.
// (Full integration tests against Postgres can be added once the DB is hosted - see README.)
const request = require('supertest');

// Mock the db pool so these tests run without a real Postgres connection.
jest.mock('../src/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn(),
}));

process.env.JWT_SECRET = 'test_secret';

const app = require('../src/server');

describe('POST /auth/register validation', () => {
  it('rejects a request with no body fields', async () => {
    const res = await request(app).post('/auth/register').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Test User', phone: '+27821234567', password: 'short' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.includes('password'))).toBe(true);
  });

  it('rejects an invalid phone number', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ fullName: 'Test User', phone: 'not-a-phone', password: 'password123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.some((e) => e.includes('phone'))).toBe(true);
  });
});

describe('POST /auth/login validation', () => {
  it('rejects a request missing password', async () => {
    const res = await request(app).post('/auth/login').send({ phone: '+27821234567' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
