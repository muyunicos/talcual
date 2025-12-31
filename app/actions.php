        case 'update_player_color':
            if (!$gameId || !$playerId) {
                $response = ['success' => false, 'message' => 'game_id y player_id requeridos'];
                break;
            }

            $state = loadGameState($gameId);

            if (!$state || !isset($state['players'][$playerId])) {
                $response = ['success' => false, 'message' => 'Jugador no encontrado'];
                break;
            }

            $newColor = validatePlayerColor($input['color'] ?? null);

            if (!$newColor) {
                $response = ['success' => false, 'message' => 'Color invalido'];
                break;
            }

            $state['players'][$playerId]['color'] = $newColor;
            $state['last_update'] = time();
            addServerNowToState($state);

            if (saveGameState($gameId, $state)) {
                trackGameAction($gameId, 'player_color_updated', []);
                notifyGameChanged($gameId);
                $response = [
                    'success' => true,
                    'message' => 'Color actualizado',
                    'server_now' => $state['server_now'],
                    'state' => $state
                ];
            } else {
                $response = ['success' => false, 'message' => 'Error actualizando color'];
            }
            break;