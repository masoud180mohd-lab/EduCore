import type { MeLike } from './home-preference';
import { prefersHeadHome } from './home-preference';

export function canAccessHeadPortal(me: MeLike): boolean {
  return prefersHeadHome(me);
}
