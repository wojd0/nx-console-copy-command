jest.mock('vscode', () => ({
  window: {
    showQuickPick: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  env: {
    clipboard: { writeText: jest.fn() },
  },
}));

import { env, window } from 'vscode';
import { selectFlags } from './select-flags';

describe('selectFlags', () => {
  it('copies the constructed command instead of executing it', async () => {
    (window.showQuickPick as jest.Mock).mockImplementation(
      async (items: { type?: string }[]) =>
        items.find((item) => item.type === 'copy'),
    );

    const result = await selectFlags('run-many', [], { target: 'build' });

    expect(env.clipboard.writeText).toHaveBeenCalledWith(
      'nx run-many --target=build',
    );
    expect(result).toBeUndefined();
  });
});
