import { describe, expect, it } from 'vitest';
import {
  classifyHttpResponse,
  isExpectedHttpStatus,
  isValidExpectedStatusExpression,
} from '../electron/engine/statusClassifier';

describe('statusClassifier', () => {
  it('validates expected status code expressions', () => {
    expect(isValidExpectedStatusExpression('200')).toBe(true);
    expect(isValidExpectedStatusExpression('200-299')).toBe(true);
    expect(isValidExpectedStatusExpression('200–299')).toBe(true);
    expect(isValidExpectedStatusExpression('200, 301, 302')).toBe(true);
    expect(isValidExpectedStatusExpression('200-299, 404')).toBe(true);

    expect(isValidExpectedStatusExpression('')).toBe(false);
    expect(isValidExpectedStatusExpression('abc')).toBe(false);
    expect(isValidExpectedStatusExpression('400-200')).toBe(false);
    expect(isValidExpectedStatusExpression('999')).toBe(false);
  });

  it('defaults to 200-399 when evaluating status codes', () => {
    expect(isExpectedHttpStatus(200)).toBe(true);
    expect(isExpectedHttpStatus(301)).toBe(true);
    expect(isExpectedHttpStatus(401)).toBe(false);
    expect(isExpectedHttpStatus(404)).toBe(false);
    expect(isExpectedHttpStatus(500)).toBe(false);
    expect(isExpectedHttpStatus(503)).toBe(false);
  });

  it('supports custom status code lists and ranges', () => {
    expect(isExpectedHttpStatus(404, '200-299, 404')).toBe(true);
    expect(isExpectedHttpStatus(301, '200, 301, 302')).toBe(true);
    expect(isExpectedHttpStatus(302, '200')).toBe(false);
  });

  it('classifies unexpected HTTP responses as DEGRADED while keeping networkConnected=true', () => {
    const res404 = classifyHttpResponse(404, 'Not Found', '200-399');
    expect(res404.state).toBe('DEGRADED');
    expect(res404.networkConnected).toBe(true);
    expect(res404.httpResponseReceived).toBe(true);
    expect(res404.applicationHealthy).toBe(false);
  });
});
