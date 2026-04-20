import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/api/assets', () => ({ AssetsApi: class {} }));
vi.mock('@/lib/assets/upload-client', () => ({ uploadAndRegister: vi.fn() }));
// Mock whatever api method you use for createProject
vi.mock('@/lib/api', () => ({
  api: {
    createProject: vi.fn(),
    sendAgentMessage: vi.fn(),
  },
}));

import NewProjectPage from './page';

describe('NewProjectPage', () => {
  it('renders drop zone + prompt textarea + Create button', () => {
    render(<NewProjectPage />);
    expect(screen.getByRole('textbox', { name: /prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('disables Create button when no files or prompt', () => {
    render(<NewProjectPage />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});
