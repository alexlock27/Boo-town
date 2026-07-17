import { mount as mountBand } from '../band.js';
export const mount = (container, params, ctx) => mountBand(container, { ...params, panel: 'jams' }, ctx);
