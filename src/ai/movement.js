export function moveToward(entity, targetPos) {
    const dx = targetPos.x - entity.position.x;
    const dy = targetPos.y - entity.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const speed = 1.5;

    entity.velocity.x += (dx / dist) * speed;
    entity.velocity.y += (dy / dist) * speed;

    // limit speed
    const maxSpeed = 3;
    const mag = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
    if (mag > maxSpeed) {
        entity.velocity.x *= maxSpeed / mag;
        entity.velocity.y *= maxSpeed / mag;
    }
}
