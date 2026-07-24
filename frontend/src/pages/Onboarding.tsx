import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { WizardChrome } from '../components/onboarding/WizardChrome'
import { GeneratingStep } from '../components/onboarding/GeneratingStep'
import { PlanReveal } from '../components/onboarding/PlanReveal'
import {
  loadWizardState,
  saveWizardState,
  wizardPlanInputs,
  type WizardState,
} from '../components/onboarding/wizardState'
import {
  BirthDatePicker,
  DietPicker,
  GoalPicker,
  HeightPicker,
  PacePicker,
  SexPicker,
  UnitToggle,
  WeightField,
  WorkoutsPicker,
} from '../components/plan/pickers'
import { todayStr, yearsBetween } from '../lib/date'

type StepId =
  | 'sex'
  | 'workouts'
  | 'birth_date'
  | 'body'
  | 'goal'
  | 'target_weight'
  | 'pace'
  | 'diet'

interface StepDef {
  id: StepId
  title: string
  subtitle?: string
  /** Skipped steps are removed from the flow entirely (e.g. pace for maintain). */
  skipped?: (s: WizardState) => boolean
  valid: (s: WizardState) => boolean
}

const STEPS: readonly StepDef[] = [
  {
    id: 'sex',
    title: 'What is your sex?',
    subtitle: 'This will be used to calibrate your custom plan.',
    valid: (s) => s.sex !== null,
  },
  {
    id: 'workouts',
    title: 'How many workouts do you do per week?',
    subtitle: 'This will be used to calibrate your custom plan.',
    valid: (s) => s.activity_level !== null,
  },
  {
    id: 'birth_date',
    title: 'When were you born?',
    subtitle:
      'This will be taken into account when calculating your daily nutrition goals.',
    valid: (s) => {
      if (!s.birth_date) return false
      const age = yearsBetween(s.birth_date, todayStr())
      return age >= 10 && age <= 120
    },
  },
  {
    id: 'body',
    title: 'Height & weight',
    subtitle:
      'This will be taken into account when calculating your daily nutrition goals.',
    valid: (s) =>
      s.height_cm !== null &&
      s.height_cm >= 90 &&
      s.height_cm <= 250 &&
      s.weight_kg !== null &&
      s.weight_kg >= 20 &&
      s.weight_kg <= 400,
  },
  {
    id: 'goal',
    title: 'What is your goal?',
    subtitle: 'This helps us generate a plan for your calorie intake.',
    valid: (s) => s.goal !== null,
  },
  {
    id: 'target_weight',
    title: 'What is your desired weight?',
    skipped: (s) => s.goal === 'maintain',
    valid: (s) =>
      s.target_weight_kg !== null &&
      s.target_weight_kg >= 20 &&
      s.target_weight_kg <= 400,
  },
  {
    id: 'pace',
    title: 'How fast do you want to reach your goal?',
    skipped: (s) => s.goal === 'maintain',
    valid: () => true,
  },
  {
    id: 'diet',
    title: 'Do you follow a specific diet?',
    valid: (s) => s.diet !== null,
  },
]

type Phase = 'questions' | 'generating' | 'reveal'

/** Pre-auth onboarding wizard; answers live in sessionStorage until register. */
export function Onboarding() {
  const navigate = useNavigate()
  const [state, setState] = useState<WizardState>(loadWizardState)
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('questions')

  useEffect(() => saveWizardState(state), [state])

  const steps = useMemo(() => STEPS.filter((st) => !st.skipped?.(state)), [state])
  const step = steps[Math.min(stepIndex, steps.length - 1)]

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }))
  }

  function goBack() {
    if (stepIndex === 0) return navigate(-1)
    setStepIndex((i) => i - 1)
  }

  function goNext() {
    if (stepIndex < steps.length - 1) return setStepIndex((i) => i + 1)
    setPhase('generating')
  }

  const planInputs = wizardPlanInputs(state)

  if (phase === 'generating') {
    return <GeneratingStep onDone={() => setPhase('reveal')} />
  }

  if (phase === 'reveal' && planInputs) {
    return (
      <PlanReveal
        inputs={planInputs}
        diet={state.diet}
        unit={state.unit}
        ctaLabel="Save my plan"
        onContinue={() => navigate('/register')}
      />
    )
  }

  return (
    <WizardChrome
      step={stepIndex}
      totalSteps={steps.length}
      title={step.title}
      subtitle={step.subtitle}
      onBack={goBack}
      footer={
        <Button
          size="xl"
          className="w-full"
          disabled={!step.valid(state)}
          onClick={goNext}
        >
          Continue
        </Button>
      }
    >
      {step.id === 'sex' && (
        <SexPicker value={state.sex} onChange={(sex) => patch({ sex })} />
      )}

      {step.id === 'workouts' && (
        <WorkoutsPicker
          value={state.activity_level}
          onChange={(activity_level) => patch({ activity_level })}
        />
      )}

      {step.id === 'birth_date' && (
        <BirthDatePicker
          value={state.birth_date}
          onChange={(birth_date) => patch({ birth_date })}
        />
      )}

      {step.id === 'body' && (
        <div className="space-y-6">
          <UnitToggle unit={state.unit} onChange={(unit) => patch({ unit })} />
          <HeightPicker
            heightCm={state.height_cm}
            unit={state.unit}
            onChange={(height_cm) => patch({ height_cm })}
          />
          <WeightField
            id="wizard_weight"
            label="Current weight"
            weightKg={state.weight_kg}
            unit={state.unit}
            onChange={(weight_kg) => patch({ weight_kg })}
          />
        </div>
      )}

      {step.id === 'goal' && (
        <GoalPicker
          value={state.goal}
          onChange={(goal) =>
            patch({
              goal,
              // A stale target on the wrong side of the current weight is
              // confusing; clear it whenever the goal changes.
              target_weight_kg: null,
            })
          }
        />
      )}

      {step.id === 'target_weight' && (
        <div className="space-y-6">
          <UnitToggle unit={state.unit} onChange={(unit) => patch({ unit })} />
          <WeightField
            id="wizard_target_weight"
            label={state.goal === 'gain' ? 'Goal weight' : 'Desired weight'}
            weightKg={state.target_weight_kg}
            unit={state.unit}
            big
            onChange={(target_weight_kg) => patch({ target_weight_kg })}
          />
        </div>
      )}

      {step.id === 'pace' && (
        <div className="pt-4">
          <p className="mb-6 text-center text-[17px] font-medium">
            {state.goal === 'gain'
              ? 'Weight gain speed per week'
              : 'Weight loss speed per week'}
          </p>
          <PacePicker
            value={state.pace_kg_per_week}
            unit={state.unit}
            onChange={(pace_kg_per_week) => patch({ pace_kg_per_week })}
          />
        </div>
      )}

      {step.id === 'diet' && (
        <DietPicker value={state.diet} onChange={(diet) => patch({ diet })} />
      )}
    </WizardChrome>
  )
}
