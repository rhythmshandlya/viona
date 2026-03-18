## File Structure
```
src/
  scenes/         # Individual scene .tsx files (default export)
  components/     # Shared components (Background.tsx)
  constants.ts    # COLORS, TIMING, SPRING_CONFIG
```

## Import Pattern
```tsx
import { COLORS, SPRING_CONFIG } from '../constants';
import { Background } from '../components/Background';
```

## Scene Export Convention
Scene files use `export default` for the component.
Example: `const MyScene: React.FC = () => { ... }; export default MyScene;`
