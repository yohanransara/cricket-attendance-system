package lk.rusl.cricket.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminAttendanceSummaryDTO {
    private List<String> dates;
    private List<StudentAttendanceSummary> studentAttendance;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentAttendanceSummary {
        private String studentId;
        private String name;
        private Map<String, Boolean> attendance; // date -> isPresent
        private double attendancePercentage;
    }
}
