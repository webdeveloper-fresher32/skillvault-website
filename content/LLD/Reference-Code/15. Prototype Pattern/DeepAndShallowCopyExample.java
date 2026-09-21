import java.util.ArrayList;
import java.util.List;

public class DeepAndShallowCopyExample {
    public static void main(String[] args) {
        List<Integer> nested = new ArrayList<>(List.of(65, 43, 21, 54));
        List<Object> list1 = new ArrayList<>(List.of(1, 4, 5, 2, nested, 99, 76, 54));

        // Deep copy simulation
        List<Integer> nestedCopy = new ArrayList<>(nested);
        List<Object> list2 = new ArrayList<>();
        for (Object item : list1) {
            if (item instanceof List<?>) {
                list2.add(new ArrayList<>((List<?>) item));
            } else {
                list2.add(item);
            }
        }

        // Mutate nested list in list2
        @SuppressWarnings("unchecked")
        List<Integer> list2Nested = (List<Integer>) list2.get(4);
        list2Nested.set(1, 1000);

        System.out.println("list1 = " + list1);
        System.out.println("list2 = " + list2);
        System.out.println("System.identityHashCode(list1.get(4)) = " + System.identityHashCode(list1.get(4)));
        System.out.println("System.identityHashCode(list2.get(4)) = " + System.identityHashCode(list2.get(4)));
    }
}
