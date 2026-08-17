import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.js';

afterEach(cleanup);

describe('React planner interface', () => {
  test('renders the default calculated plan and product names in BoMs', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Glass railing planner' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Section 1' })).toBeTruthy();

    const glassTable = screen.getByRole('table', {
      name: 'Glass bill of materials',
    });
    expect(within(glassTable).getByText('Product name')).toBeTruthy();

    const disabledVariant = screen.getByRole('option', {
      name: '1000 mm Top-Mounted',
    }) as HTMLOptionElement;
    expect(disabledVariant.disabled).toBe(true);
  });

  test('adds sections and switches to the base-rail form and result', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Add section' }));
    expect(screen.getByRole('group', { name: 'Section 2' })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Railing system'), 'UC');
    expect(screen.getByLabelText('Gap between panels')).toBeTruthy();
    expect(screen.getByLabelText('Glass color')).toBeTruthy();

    const calculateButtons = screen.getAllByRole('button', {
      name: 'Calculate plan',
    });
    await user.click(calculateButtons.at(-1)!);

    expect(
      screen.getByRole('table', { name: 'Base-rail bill of materials' }),
    ).toBeTruthy();
  });
});
