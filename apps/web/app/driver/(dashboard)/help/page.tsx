import { Phone } from 'lucide-react';
import { EPYC_DISPATCH_PHONE_DISPLAY, EPYC_DISPATCH_PHONE_TEL } from '@/lib/driver-job';
import { IosSteps } from '@/components/driver/InstallAppCard';

export const metadata = {
  title: 'Driver Help | EPYC Courier',
};

const sections: { title: string; points: string[] }[] = [
  {
    title: 'Getting jobs',
    points: [
      'Tap Online on the Find Jobs screen to receive offers.',
      'Each offer shows the cities, the pickup and drop-off windows, the item, and what you will earn. Street addresses and contacts appear after you accept.',
      'Tap Accept to take the job. If another driver accepted first, you will see "Job already taken".',
      'Tap Decline if it does not work for you. Declining, or letting an offer run out, never counts against you.',
    ],
  },
  {
    title: 'At pickup',
    points: [
      'Tap Navigate to pickup. The first time, pick Google Maps, Apple Maps, or Waze; the app remembers it.',
      'If you see "Not ready before", the store is not ready yet. You can start 15 minutes before the pickup window.',
      'When you get there, tap "I\'ve arrived at pickup".',
      'If there is a Pickup reference #, give it to the store.',
      'Take at least one photo of the item(s), up to 4.',
      'Take a photo of the receipt or bill of lading. If there is none, tick "No receipt given" and write a short note.',
      'Tap Pickup complete.',
    ],
  },
  {
    title: 'At drop-off',
    points: [
      'Tap Navigate to drop-off, then "I\'ve arrived at drop-off" when you get there.',
      'Enter the name of the person who received it.',
      'Choose where or with whom you left it (recipient, front desk, mailroom, door, loading dock, or other).',
      'Take a photo showing where you left it. A photo of the person is optional.',
      'If the job needs a signature, have the recipient sign on screen. If nobody can sign, tick "Left without signature" and write a short note.',
      'Tap Complete delivery.',
    ],
  },
  {
    title: 'Report a problem',
    points: [
      'Tap "Report a problem" on the job at any step: can\'t get in, nobody there, store not ready, wrong or damaged item, vehicle issue, or other.',
      'Add a note (required for Other) and a photo if it helps.',
      'Dispatch is alerted right away. The job stays with you unless you release it.',
    ],
  },
  {
    title: 'Release a job',
    points: [
      'If you cannot do a job, tap "Release job" before pickup and choose a reason.',
      'The job goes back to dispatch for another driver.',
      'After you have picked the item up, you cannot release it. Call dispatch instead.',
    ],
  },
  {
    title: 'Getting paid',
    points: [
      // PLACEHOLDER: pending the Commander's pay decision. Replace this line when decided.
      'Placeholder until confirmed: EPYC pays completed jobs weekly; dispatch confirms the amount.',
      'What you will earn is shown on every offer and on the job screen.',
    ],
  },
];

export default function DriverHelpPage() {
  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-gray-900">Driver Help</h1>

      <a
        href={EPYC_DISPATCH_PHONE_TEL}
        className="flex items-center justify-center w-full py-4 bg-epyc-primary text-white rounded-xl font-semibold text-lg touch-target"
      >
        <Phone className="h-6 w-6 mr-2" />
        Call dispatch {EPYC_DISPATCH_PHONE_DISPLAY}
      </a>

      {sections.map((section) => (
        <section key={section.title} className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-2">{section.title}</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {section.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Install on your phone</h2>
        <p className="text-sm text-gray-700">
          Put EPYC Driver on your home screen so it opens full screen like any other app. Nothing to download
          from an app store.
        </p>
        <h3 className="font-medium text-gray-900 mt-3">iPhone (Safari)</h3>
        <IosSteps />
        <h3 className="font-medium text-gray-900 mt-3">Android (Chrome)</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 mt-1">
          <li>Tap Install EPYC Driver on the Find Jobs screen, then tap Install.</li>
          <li>No button? Tap the three-dot menu, then Install app (or Add to Home screen).</li>
        </ul>
        <p className="text-sm text-gray-700 mt-3">
          Keep the app open during a job. Once it is closed, it cannot run in the background or share your
          location.
        </p>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Contact dispatch</h2>
        <p className="text-sm text-gray-700">
          Call{' '}
          <a href={EPYC_DISPATCH_PHONE_TEL} className="text-epyc-primary underline">
            {EPYC_DISPATCH_PHONE_DISPLAY}
          </a>{' '}
          any time you are stuck, running late, or something does not look right.
        </p>
      </section>
    </div>
  );
}
