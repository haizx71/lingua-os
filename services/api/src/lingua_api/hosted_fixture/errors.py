"""Static failure classes for the private fixture control plane."""


class FixtureUnauthenticated(Exception):
    pass


class FixtureForbidden(Exception):
    pass


class FixtureConflict(Exception):
    pass


class FixtureUnavailable(Exception):
    pass


class FixtureInternal(Exception):
    pass
