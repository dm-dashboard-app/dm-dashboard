import { flattenEncounterStates } from '../../utils/encounterState';

export function flattenStates(data) {
  return flattenEncounterStates(data);
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
