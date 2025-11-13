import { chooseAction } from './behavior.js';
import { moveToward } from './movement.js';

export function updateAI(entity, world) {
    console.log(`[DEBUG][AI] Updating ${entity.name}`);

    const action = chooseAction(entity, world);

    if (action === 'chase' && entity.target) {
        moveToward(entity, entity.target.position);
    } else if (action === 'wander') {
        moveToward(entity, {
            x: entity.position.x + (Math.random() - 0.5) * 10,
            y: entity.position.y + (Math.random() - 0.5) * 10
        });
    } else {
        // idle
        entity.velocity.x *= 0.9;
        entity.velocity.y *= 0.9;
    }

    console.log(`[DEBUG][AI] ${entity.name} decided to ${action}`);
}
