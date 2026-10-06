import { useEffect, useState } from 'react';
import { detectAgent, isAgentPaired, getAgentPairings, probeAnyAgentListening } from '@/services/printAgentV2Service';

export type PrintAgentStatus =
  | 'checking'
  | 'not-detected'   // agent not installed/running on this machine — not
                      // necessarily a problem, many stores print via browser
  | 'origin-blocked'  // agent IS running (something answered on the port),
                      // but it rejected this page's origin outright (its own
                      // CORS allowlist, ZETTAZ_AGENT_ALLOWED_ORIGINS, doesn't
                      // include this origin) — this happens before pairing
                      // is even checked, e.g. a local dev origin that isn't
                      // in an older/differently-configured agent's allowlist
  | 'not-paired'      // agent is running but this browser has never paired
  | 'invalid-pairing' // agent is running, a token is stored, but the agent
                      // rejects it (401) — reinstall, unpair, or a different
                      // agent instance than the one that issued the token
  | 'paired';         // agent running and this browser's token is valid

/**
 * Checks whether the Zettaz Print Agent is installed, running, and paired
 * with this browser. Runs once per mount (cheap: a couple of local
 * 127.0.0.1 requests, silently fails fast if nothing is listening).
 *
 * Deliberately does NOT nag when the agent simply isn't installed
 * (`not-detected`) — plenty of stores only ever use browser print and have
 * never installed the agent. It only surfaces as something to fix once the
 * agent has been detected running but this browser can't actually use it.
 */
export function usePrintAgentStatus() {
  const [status, setStatus] = useState<PrintAgentStatus>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      let port: number;
      try {
        const detected = await detectAgent();
        port = detected.port;
      } catch {
        // Could be "nothing is listening" or "something is listening but
        // blocked our origin before we ever got a readable response" — a
        // no-cors probe tells them apart (see probeAnyAgentListening's docs).
        const somethingIsListening = await probeAnyAgentListening();
        if (active) setStatus(somethingIsListening ? 'origin-blocked' : 'not-detected');
        return;
      }
      if (!isAgentPaired()) {
        if (active) setStatus('not-paired');
        return;
      }
      try {
        await getAgentPairings(port);
        if (active) setStatus('paired');
      } catch {
        // Token stored locally but the agent rejected it — most commonly a
        // freshly (re)installed agent whose ConfigStore no longer has the
        // TokenHash that issued this browser's token, since the agent
        // persists exactly one pairing at a time (see config_store.go).
        if (active) setStatus('invalid-pairing');
      }
    })();
    return () => { active = false; };
  }, []);

  return status;
}
