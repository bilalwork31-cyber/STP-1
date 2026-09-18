from django.test import SimpleTestCase

from trips import towns


class FindTests(SimpleTestCase):
    def test_finds_city_and_state(self):
        place = towns.find("Chicago, IL")
        self.assertEqual(place.label, "Chicago, IL")
        self.assertAlmostEqual(place.lat, 41.85, places=1)

    def test_ignores_case_spacing_and_country_suffix(self):
        self.assertEqual(towns.find("  green bay ,wi, USA ").label, "Green Bay, WI")

    def test_accepts_the_common_name_of_new_york(self):
        self.assertEqual(towns.find("New York, NY").label, "New York City, NY")

    def test_returns_none_for_addresses_and_unknown_towns(self):
        self.assertIsNone(towns.find("233 S Wacker Dr, Chicago"))
        self.assertIsNone(towns.find("Qwzxv, TX"))


class SuggestTests(SimpleTestCase):
    def test_ranks_prefix_matches_by_population(self):
        labels = [place.label for place in towns.suggest("chica")]
        self.assertEqual(labels[0], "Chicago, IL")
        self.assertLessEqual(len(labels), towns.SUGGESTION_COUNT)

    def test_narrows_by_state_after_a_comma(self):
        labels = [place.label for place in towns.suggest("Springfield, M")]
        self.assertTrue(labels)
        self.assertTrue(all(label.split(", ")[1].startswith("M") for label in labels))


class NearestTests(SimpleTestCase):
    def test_names_the_closest_town(self):
        self.assertEqual(towns.nearest((39.121, -88.545)), "Effingham, IL")

    def test_widens_the_search_in_empty_country(self):
        self.assertTrue(towns.nearest((40.8, -116.0)).endswith(", NV"))
