# LINGUA OS Domain Context

LINGUA OS separates authentication identity from the product-owned learner state used by the
learning loop.

## Identity and profile language

**Supabase Auth Identity**:
The external authentication identity established by a verified Supabase access token and its
stable subject UUID.
_Avoid_: User profile, learner profile, application account

**LINGUA Application User**:
The product identity whose UUID equals the Supabase Auth Identity subject and owns LINGUA data.
_Avoid_: Supabase user, auth session

**Learner Profile**:
The one-per-application-user product profile containing learner-wide settings such as display name,
interface language, and timezone.
_Avoid_: Auth profile, language profile

**Language Profile**:
An owned learning context for one target language, including native/support language, goal, daily
study target, level references, and lifecycle status.
_Avoid_: Learner profile, course, scheduler

**Interface Language**:
The learner-wide UI locale owned by `learner_profiles.interface_language_code`. It is distinct from
the Language Profile's native/support language; a legacy same-named `user_languages` column must
not be treated as proof of semantic equivalence.
_Avoid_: Native language, target language

**Onboarding Readiness**:
The current product state in which learner timezone and an active supported Language Profile are
available for the learning loop; it is not equivalent to authentication.
_Avoid_: Logged in, assessment complete

**Starting Level Estimate**:
An optional evidence-based initial estimate owned by the Assessment domain, not a certification or
a prerequisite for Onboarding Readiness.
_Avoid_: Certified CEFR level, placement certificate
