import { parseSuccessData } from './envelope';

describe('parseSuccessData', () => {
  it('unwraps data from envelope', () => {
    expect(parseSuccessData<{ x: number }>({ success: true, data: { x: 1 } })).toEqual({ x: 1 });
  });

  it('throws on success false', () => {
    expect(() =>
      parseSuccessData({
        success: false,
        error: { message: 'bad' },
      }),
    ).toThrow('bad');
  });
});
