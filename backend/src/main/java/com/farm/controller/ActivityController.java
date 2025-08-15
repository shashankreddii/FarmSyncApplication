package com.farm.controller;

import com.farm.entity.Activity;
import com.farm.repository.ActivityRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activities")
@CrossOrigin
public class ActivityController {
    private final ActivityRepository activityRepository;
    public ActivityController(ActivityRepository activityRepository) { this.activityRepository = activityRepository; }

    @GetMapping
    public List<Activity> getAll() { return activityRepository.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Activity> getById(@PathVariable Long id) {
        return activityRepository.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Activity create(@RequestBody Activity activity) { return activityRepository.save(activity); }

    @PutMapping("/{id}")
    public ResponseEntity<Activity> update(@PathVariable Long id, @RequestBody Activity update) {
        return activityRepository.findById(id).map(a -> {
            a.setType(update.getType());
            a.setDescription(update.getDescription());
            a.setDate(update.getDate());
            a.setCrop(update.getCrop());
            return ResponseEntity.ok(activityRepository.save(a));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!activityRepository.existsById(id)) return ResponseEntity.notFound().build();
        activityRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}


