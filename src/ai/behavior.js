import { distance } from './utils.js';

export function chooseAction(entity, world) {
    const enemies = world.entities.filter(e => e.team !== entity.team);

    let closest = null;
    let minDist = Infinity;

    for (const e of enemies) {
        const d = distance(entity.position, e.position);
        if (d < minDist) {
            minDist = d;
            closest = e;
        }
    }

    if (closest && minDist < 100) {
        entity.target = closest;
        return 'chase';
    }

    if (Math.random() < 0.02) {
        return 'wander';
    }

    return 'idle';
}
