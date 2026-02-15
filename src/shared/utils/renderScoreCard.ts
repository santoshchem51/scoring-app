import type { Match } from '../../data/types';

export function renderScoreCard(match: Match): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  const t1Color = match.team1Color ?? '#22c55e';
  const t2Color = match.team2Color ?? '#f97316';

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, '#161625');
  grad.addColorStop(1, '#1e1e2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Logo wordmark
  ctx.textAlign = 'center';
  ctx.font = '700 48px Oswald, system-ui, sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('Pickle', 480, 100);
  ctx.fillStyle = '#facc15';
  ctx.fillText('Score', 640, 100);

  // Date
  ctx.font = '400 28px system-ui, sans-serif';
  ctx.fillStyle = '#a0aec0';
  ctx.fillText(new Date(match.startedAt).toLocaleDateString(), 540, 150);

  // VS divider line
  ctx.strokeStyle = '#363650';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(540, 220);
  ctx.lineTo(540, 800);
  ctx.stroke();

  // Team 1 (left side)
  ctx.textAlign = 'center';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillStyle = t1Color;
  ctx.fillText(match.team1Name, 270, 300);

  // Team 2 (right side)
  ctx.fillStyle = t2Color;
  ctx.fillText(match.team2Name, 810, 300);

  // Scores per game
  match.games.forEach((game, i) => {
    const y = 420 + i * 120;

    // Game label
    ctx.font = '400 24px system-ui, sans-serif';
    ctx.fillStyle = '#a0aec0';
    ctx.fillText(`Game ${game.gameNumber}`, 540, y - 30);

    // Team 1 score
    ctx.font = '700 72px Oswald, system-ui, sans-serif';
    ctx.fillStyle = game.winningSide === 1 ? t1Color : '#e2e8f0';
    ctx.fillText(String(game.team1Score), 270, y + 40);

    // Team 2 score
    ctx.fillStyle = game.winningSide === 2 ? t2Color : '#e2e8f0';
    ctx.fillText(String(game.team2Score), 810, y + 40);
  });

  // Winner banner
  const winnerName = match.winningSide === 1 ? match.team1Name : match.team2Name;
  const winnerColor = match.winningSide === 1 ? t1Color : t2Color;
  ctx.font = '700 40px Oswald, system-ui, sans-serif';
  ctx.fillStyle = winnerColor;
  ctx.fillText(`${winnerName} Wins!`, 540, 900);

  // Match info
  ctx.font = '400 24px system-ui, sans-serif';
  ctx.fillStyle = '#a0aec0';
  const mode = match.config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally';
  const type = match.config.gameType === 'doubles' ? 'Doubles' : 'Singles';
  ctx.fillText(`${type} \u00b7 ${mode} \u00b7 To ${match.config.pointsToWin}`, 540, 950);

  // Watermark
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Scored with PickleScore', 540, 1040);

  return canvas;
}
