const packageJson = require('../../package.json');

describe('package metadata', () => {
  it('publishes discoverability links for npm', () => {
    expect(packageJson.version).toBe('0.2.0');
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/nestarc/nestjs-pagination.git',
    });
    expect(packageJson.homepage).toBe('https://nestarc.dev/packages/pagination/');
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/nestarc/nestjs-pagination/issues',
    });
  });
});
